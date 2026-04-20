const inquirer = require('inquirer');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const {
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    deleteBulkTasks,
    scheduleDelete,
    cancelScheduledDelete,
    getPresignedUrls,
    uploadFileToS3,
} = require('../api');
const { getToken, saveTaskCache, resolveTaskId } = require('../config');
const { success, error, info, warn, printTaskList, printTask, printTaskOpen } = require('../ui');

function requireAuth() {
    if (!getToken()) {
        error('You are not logged in. Please run: texta login');
        process.exit(1);
    }
}

async function resolveId(input) {
    const result = resolveTaskId(input);

    if (result.fromCache) {
        info(
            '#' +
                result.num +
                ' -> ' +
                chalk.dim(result.id) +
                '  ' +
                chalk.dim('"' + result.msg + '"')
        );
        return result.id;
    }

    if (result.notFound) {
        if (result.cacheEmpty) {
            error('No task list cached. Run `texta list` first, then use the # number.');
        } else {
            error('#' + result.num + ' not found in your last list. Run `texta list` to refresh.');
        }
        process.exit(1);
    }

    if (!/^[a-f0-9]{24}$/i.test(String(result.id))) {
        error(
            '"' +
                input +
                '" is not a valid task reference. Use a row # or full 24-char ID. Run `texta list` to see numbers.'
        );
        process.exit(1);
    }

    return result.id;
}

function parseTime(str) {
    if (!str) return null;
    const match = str.trim().match(/^(\d+)(d|h|m|s)$/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    return {
        value,
        unit,
        duration: `${value}${unit}`,
        ms: value * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit],
    };
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d} day${d > 1 ? 's' : ''}`;
    if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
    if (m > 0) return `${m} minute${m > 1 ? 's' : ''}`;
    return `${s} second${s > 1 ? 's' : ''}`;
}

function formatDeleteAt(iso) {
    return new Date(iso).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const MIME_MAP = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
};

function getMimeType(ext) {
    return MIME_MAP[ext.toLowerCase()] || 'application/octet-stream';
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function listCommand(options = {}) {
    requireAuth();
    const spinner = ora('Fetching your tasks...').start();
    try {
        const tasks = await getTasks({
            status: options.status,
            search: options.search,
        });
        spinner.stop();
        saveTaskCache(tasks);
        printTaskList(tasks);
    } catch (err) {
        spinner.stop();
        error(`Failed to fetch tasks: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }
}

async function addCommand(message, options = {}) {
    requireAuth();
    if (!message || !message.trim()) {
        error('Message cannot be empty. Usage: texta add <message>');
        process.exit(1);
    }
    const spinner = ora('Creating task...').start();
    try {
        const task = await createTask(message.trim(), { status: options.status || 'pending' });
        spinner.stop();
        success(`Task created! ID: ${task.id || task._id}`);
        console.log(`  -> "${task.message}"\n`);
    } catch (err) {
        spinner.stop();
        error(`Failed to create task: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }
}

async function viewCommand(ref) {
    requireAuth();
    const id = await resolveId(ref);
    const spinner = ora('Fetching task...').start();
    try {
        const task = await getTask(id);
        spinner.stop();
        printTask(task);
    } catch (err) {
        spinner.stop();
        error(`Failed to fetch task: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }
}

async function openCommand(ref) {
    requireAuth();
    const id = await resolveId(ref);
    const spinner = ora('Opening task...').start();
    try {
        const task = await getTask(id);
        spinner.stop();
        printTaskOpen(task);
    } catch (err) {
        spinner.stop();
        error(`Failed to open task: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }
}

async function updateCommand(ref, options = {}) {
    requireAuth();
    const id = await resolveId(ref);
    const updates = {};

    if (!options.message && !options.status) {
        const task = await getTask(id).catch(() => null);
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'message',
                message: 'New message (leave empty to keep current):',
                default: task?.message || '',
            },
            {
                type: 'list',
                name: 'status',
                message: 'Status:',
                choices: ['pending', 'in-progress', 'done'],
                default: task?.status || 'pending',
            },
        ]);
        if (answers.message) updates.message = answers.message;
        if (answers.status) updates.status = answers.status;
    } else {
        if (options.message) updates.message = options.message;
        if (options.status) updates.status = options.status;
    }

    const spinner = ora('Updating task...').start();
    try {
        const task = await updateTask(id, updates);
        spinner.stop();
        success('Task updated!');
        printTask(task);
    } catch (err) {
        spinner.stop();
        error(`Failed to update task: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }
}

async function deleteMultiple(refs, options = {}) {
    const resolved = [];
    for (const part of refs) {
        const r = resolveTaskId(part);
        if (r.fromCache) {
            resolved.push({ id: r.id, label: `#${r.num} "${r.msg}"` });
        } else if (r.notFound) {
            warn(`#${r.num} not in last list - skipping. Run \`texta list\` to refresh.`);
        } else if (/^[a-f0-9]{24}$/i.test(String(r.id))) {
            resolved.push({ id: r.id, label: r.id });
        } else {
            warn(`"${part}" is not a valid # or ID - skipping.`);
        }
    }

    if (resolved.length === 0) {
        error('No valid tasks to delete.');
        process.exit(1);
    }

    if (!options.yes) {
        console.log('');
        console.log(chalk.yellow(`  About to delete ${resolved.length} task(s):`));
        resolved.forEach((r) => console.log(chalk.dim(`    * ${r.label}`)));
        console.log('');
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Delete these ${resolved.length} task(s)?`,
                default: false,
            },
        ]);
        if (!confirm) {
            info('Cancelled.');
            return;
        }
    }

    const ids = resolved.map((r) => r.id);
    const spinner = ora(`Deleting ${ids.length} task(s)...`).start();
    try {
        const result = await deleteBulkTasks({ ids });
        spinner.stop();
        success(`${result.deleted} task(s) deleted.`);
    } catch (err) {
        spinner.stop();
        error(`Failed: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }
}

async function deleteCommand(ref, more, options = {}) {
    requireAuth();

    const extraArgs = Array.isArray(more) ? more : more ? [more] : [];
    let timeArg = null;
    const extraRefs = [...extraArgs];
    if (extraRefs.length > 0 && /^\d+(d|h|m|s)$/i.test(extraRefs[extraRefs.length - 1])) {
        timeArg = extraRefs.pop();
    }

    const allRefs = [ref, ...extraRefs]
        .flatMap((r) => String(r).split(','))
        .map((r) => r.trim())
        .filter(Boolean);

    if (allRefs.length > 1) {
        return deleteMultiple(allRefs, options);
    }

    const singleRef = allRefs[0];

    if (String(singleRef).trim().toLowerCase() === 'all') {
        if (!options.yes) {
            let count = '?';
            try {
                const tasks = await getTasks();
                count = tasks.length;
            } catch {}

            console.log('');
            console.log(chalk.red('  WARNING: This will permanently delete ALL ' + count + ' task(s)'));
            console.log(chalk.red('  and every file attached to them.'));
            console.log('');

            const { confirmText } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'confirmText',
                    message: 'Type DELETE to confirm:',
                },
            ]);
            if (confirmText.trim() !== 'DELETE') {
                info('Cancelled - nothing was deleted.');
                return;
            }
        }

        const spinner = ora('Deleting all tasks...').start();
        try {
            await deleteBulkTasks({ all: true });
            spinner.stop();
            success('All tasks deleted.');
        } catch (err) {
            spinner.stop();
            error(`Failed: ${err.response?.data?.message || err.message}`);
            process.exit(1);
        }
        return;
    }

    const id = await resolveId(singleRef);

    if (timeArg) {
        const parsed = parseTime(timeArg);
        if (!parsed) {
            error(`Invalid time format: "${timeArg}". Use: 1d, 6h, 30m, 45s`);
            process.exit(1);
        }
        const duration = formatDuration(parsed.ms);
        if (!options.yes) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Schedule task to auto-delete in ${duration}?`,
                    default: true,
                },
            ]);
            if (!confirm) {
                info('Cancelled.');
                return;
            }
        }
        const spinner = ora(`Scheduling deletion in ${duration}...`).start();
        try {
            const task = await scheduleDelete(id, parsed.duration);
            spinner.stop();
            success(`Task scheduled for auto-delete in ${chalk.yellow(duration)}`);
            if (task.deleteAt) {
                info(`Will be deleted at: ${chalk.dim(formatDeleteAt(task.deleteAt))}`);
            }
            console.log(chalk.dim(`  Tip: texta delete ${ref} --cancel   to cancel the timer.`));
        } catch (err) {
            spinner.stop();
            error(`Failed: ${err.response?.data?.message || err.message}`);
            process.exit(1);
        }
        return;
    }

    if (options.cancel) {
        const spinner = ora('Cancelling timer...').start();
        try {
            await cancelScheduledDelete(id);
            spinner.stop();
            success('Auto-delete timer cancelled.');
        } catch (err) {
            spinner.stop();
            error(`Failed: ${err.response?.data?.message || err.message}`);
            process.exit(1);
        }
        return;
    }

    if (!options.yes) {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Delete this task? This also removes all attached files.',
                default: false,
            },
        ]);
        if (!confirm) {
            info('Deletion cancelled.');
            return;
        }
    }

    const spinner = ora('Deleting task...').start();
    try {
        await deleteTask(id);
        spinner.stop();
        success('Task deleted.');
    } catch (err) {
        spinner.stop();
        error(`Failed: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }
}

function parsePathsFromText(raw) {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            if (
                (line.startsWith('"') && line.endsWith('"')) ||
                (line.startsWith("'") && line.endsWith("'"))
            ) {
                return line.slice(1, -1).trim();
            }
            return line;
        })
        .filter(Boolean);
}

async function promptForPaths() {
    console.log('');
    console.log(chalk.cyan('  Paste your file paths below.'));
    console.log(chalk.dim('  * Paste multiple Windows Explorer paths at once (one per line)'));
    console.log(chalk.dim('  * Surrounding quotes are stripped automatically'));
    console.log(chalk.dim('  * Press Enter on a blank line when done\n'));

    const lines = [];
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });

    await new Promise((resolve) => {
        rl.setPrompt('  > ');
        rl.prompt();
        rl.on('line', (line) => {
            if (line.trim() === '') {
                rl.close();
            } else {
                lines.push(line);
                rl.prompt();
            }
        });
        rl.on('close', resolve);
    });

    return parsePathsFromText(lines.join('\n'));
}

async function uploadCommand(taskRef, filePaths) {
    requireAuth();
    const taskId = await resolveId(taskRef);

    let files = Array.isArray(filePaths) ? filePaths : filePaths ? [filePaths] : [];
    if (files.length === 0) {
        files = await promptForPaths();
        if (files.length === 0) {
            error('No file paths provided. Cancelled.');
            process.exit(1);
        }
    }

    files = files.map((file) => file.replace(/\\/g, '/'));

    const invalid = files.filter((file) => !fs.existsSync(file));
    if (invalid.length > 0) {
        invalid.forEach((file) => error(`File not found: ${file}`));
        if (invalid.length === files.length) process.exit(1);
        files = files.filter((file) => fs.existsSync(file));
        warn(`Skipping ${invalid.length} missing file(s), uploading the rest...`);
    }

    console.log('');
    console.log(
        chalk.cyan(
            `  Uploading ${files.length} file${files.length > 1 ? 's' : ''} to task ${taskId}...`
        )
    );
    console.log('');

    let uploaded = 0;
    let failed = 0;

    try {
        const presignedData = await getPresignedUrls(
            taskId,
            files.map((filePath) => path.basename(filePath))
        );

        for (let index = 0; index < files.length; index++) {
            const filePath = files[index];
            const filename = path.basename(filePath);
            const ext = path.extname(filename);
            const contentType = getMimeType(ext);
            const stat = fs.statSync(filePath);
            const size = stat.size;
            const presignedUrl = presignedData.presignedUrls?.[index];

            const spinner = ora(
                `  [${index + 1}/${files.length}] ${filename} ${chalk.dim(formatBytes(size))}`
            ).start();

            try {
                if (!presignedUrl) {
                    throw new Error('Upload URL not returned by backend');
                }
                spinner.text = `  [${index + 1}/${files.length}] Uploading ${filename}...`;
                await uploadFileToS3(presignedUrl, filePath, contentType);
                spinner.stop();
                console.log(
                    chalk.green('  OK') +
                        ` ${filename}  ${chalk.dim(formatBytes(size))}  ${chalk.dim(contentType)}`
                );
                uploaded++;
            } catch (err) {
                spinner.stop();
                const msg = err.response?.data?.message || err.message;
                console.log(chalk.red('  FAIL') + ` ${filename}  ${chalk.red(msg)}`);
                failed++;
            }
        }
    } catch (err) {
        error(`Failed to prepare uploads: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }

    console.log('');
    if (uploaded > 0) success(`${uploaded} file${uploaded > 1 ? 's' : ''} uploaded successfully.`);
    if (failed > 0) warn(`${failed} file${failed > 1 ? 's' : ''} failed to upload.`);
    if (uploaded > 0) info(`Run \`texta open ${taskId}\` to view attached file keys.`);
    console.log('');
}

async function detachCommand(taskRef, attachmentRef) {
    requireAuth();
    const taskId = await resolveId(taskRef);

    if (!attachmentRef || attachmentRef.trim() === '') {
        error('File reference is required. Run `texta open <taskId>` to see numbered files.');
        process.exit(1);
    }

    const task = await getTask(taskId);
    const urls = Array.isArray(task.url) ? [...task.url] : [];

    if (urls.length === 0) {
        error('This task has no attached files.');
        process.exit(1);
    }

    let index = -1;
    if (/^\d+$/.test(String(attachmentRef).trim())) {
        index = parseInt(attachmentRef, 10) - 1;
    } else {
        index = urls.findIndex((entry) => entry === attachmentRef);
    }

    if (index < 0 || index >= urls.length) {
        error('File reference not found. Use the file number shown in `texta open <taskId>`.');
        process.exit(1);
    }

    const removed = urls[index];
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Remove attached file #${index + 1}?`,
            default: false,
        },
    ]);
    if (!confirm) {
        info('Cancelled.');
        return;
    }

    urls.splice(index, 1);

    const spinner = ora('Removing attached file reference...').start();
    try {
        await updateTask(taskId, { url: urls });
        spinner.stop();
        success(`Removed file: ${path.basename(removed)}`);
    } catch (err) {
        spinner.stop();
        error(`Failed to remove attachment: ${err.response?.data?.message || err.message}`);
        process.exit(1);
    }
}

module.exports = {
    listCommand,
    addCommand,
    viewCommand,
    openCommand,
    updateCommand,
    deleteCommand,
    uploadCommand,
    detachCommand,
};
