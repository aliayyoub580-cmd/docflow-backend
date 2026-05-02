/**
 * Simple Node worker using BullMQ to process conversion jobs.
 * This delegates real document conversion to the Python worker converters.
 */
import { Worker } from 'bullmq';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { updateJobStatus as updateJobStatusDb } from '../src/config/supabase.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workersRoot = path.resolve(__dirname, '..', '..', 'workers');

async function runPythonConversion(moduleName, inputPath, outputFormat) {
  const pythonCode = [
    'import sys',
    'from pathlib import Path',
    `sys.path.insert(0, ${JSON.stringify(workersRoot)})`,
    `from converters.${moduleName} import convert`,
    `out = convert(${JSON.stringify(inputPath)}, ${JSON.stringify(outputFormat)})`,
    'print(out)'
  ].join('; ');

  const result = await execFileAsync('python', ['-c', pythonCode], {
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${workersRoot}${path.delimiter}${process.env.PYTHONPATH}`
        : workersRoot
    }
  });

  const outputPath = result.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
  if (!outputPath) {
    throw new Error(result.stderr || 'Python conversion did not return an output path');
  }

  return outputPath;
}

const handlerMap = {
  'pdf-to-word': async (data) => runPythonConversion('pdf_to_word', data.inputPath, 'docx'),
  'word-to-pdf': async (data) => runPythonConversion('word_to_pdf', data.inputPath, 'pdf'),
};

const worker = new Worker('conversions', async (job) => {
  const { data } = job;
  const tool = data.tool;
  const jobId = job.id;

  try {
    await updateJobStatusDb(jobId, 'processing');
    const handler = handlerMap[tool];
    if (!handler) throw new Error('No handler in Node worker for ' + tool);
    const outputPath = await handler(data);
    await updateJobStatusDb(jobId, 'completed', { outputPath });
    return { outputPath };
  } catch (err) {
    await updateJobStatusDb(jobId, 'failed', { errorMessage: err.message });
    throw err;
  }
});

worker.on('completed', (job) => console.log('Node worker completed job', job.id));
worker.on('failed', (job, err) => console.error('Node worker failed job', job.id, err));

console.log('Node worker started');
