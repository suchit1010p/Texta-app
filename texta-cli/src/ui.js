const chalk = require('chalk');
const Table = require('cli-table3');
const figlet = require('figlet');

function banner() {
    const text = figlet.textSync('texta', { font: 'Big', horizontalLayout: 'default' });
    console.log(chalk.cyan(text));
    console.log(chalk.dim('  Your smart task manager from the terminal\n'));
}

function welcomeBanner(username) {
    console.log('');
    console.log(chalk.cyan('  =================================='));
    console.log(chalk.bold.white('     Welcome to texta'));
    console.log(chalk.green(`     Hello, ${username}`));
    console.log(chalk.cyan('  =================================='));
    console.log('');
}

function registeredBanner(username) {
    console.log('');
    console.log(chalk.cyan('  =================================='));
    console.log(chalk.bold.white('     Account Created'));
    console.log(chalk.green(`     Welcome, ${username}`));
    console.log(chalk.cyan('  =================================='));
    console.log('');
}

function success(msg) {
    console.log(chalk.green('  OK ') + chalk.white(msg));
}
function error(msg) {
    console.log(chalk.red('  ERR ') + chalk.white(msg));
}
function info(msg) {
    console.log(chalk.blue('  INFO ') + chalk.white(msg));
}
function warn(msg) {
    console.log(chalk.yellow('  WARN ') + chalk.white(msg));
}

function formatExpiry(deleteAt) {
    if (!deleteAt) return chalk.dim('none');
    const diff = new Date(deleteAt).getTime() - Date.now();
    if (diff <= 0) return chalk.red('expired');
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return chalk.yellow(`${d}d ${h % 24}h`);
    if (h > 0) return chalk.yellow(`${h}h ${m % 60}m`);
    if (m > 0) return chalk.yellow(`${m}m`);
    return chalk.red(`${s}s`);
}

function formatStatus(status) {
    if (status === 'done') return chalk.green('done');
    if (status === 'in-progress') return chalk.yellow('in-progress');
    return chalk.dim('pending');
}

function formatSize(bytes) {
    if (!bytes) return chalk.dim('-');
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(category, contentType) {
    if (category === 'image') return 'IMG';
    if (contentType === 'application/pdf') return 'PDF';
    if (contentType && contentType.includes('word')) return 'DOC';
    if (contentType && contentType.includes('sheet')) return 'XLS';
    if (contentType && contentType.includes('presentation')) return 'PPT';
    if (contentType && contentType.startsWith('text/')) return 'TXT';
    return 'FILE';
}

function printTaskList(tasks) {
    if (!tasks || tasks.length === 0) {
        info('No tasks found. Add one with: texta add <message>');
        return;
    }

    console.log('');
    const table = new Table({
        head: [
            chalk.cyan('#'),
            chalk.cyan('Task'),
            chalk.cyan('Status'),
            chalk.cyan('Files'),
            chalk.cyan('Expires'),
            chalk.cyan('Created'),
        ],
        colWidths: [5, 42, 15, 7, 12, 14],
        style: { head: [], border: ['dim'] },
    });

    tasks.forEach((task, i) => {
        const msg = task.message.length > 39 ? task.message.substring(0, 39) + '...' : task.message;
        const created = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '-';
        const fileCount = Array.isArray(task.url) ? task.url.length : 0;

        table.push([
            chalk.dim(i + 1),
            msg,
            formatStatus(task.status),
            fileCount > 0 ? chalk.cyan(String(fileCount)) : chalk.dim('-'),
            formatExpiry(task.deleteAt),
            chalk.dim(created),
        ]);
    });

    console.log(table.toString());
    console.log(chalk.dim(`\n  Total: ${tasks.length} task(s)\n`));
}

function printTask(task) {
    const files = task.attachments || [];
    console.log('');
    console.log(chalk.cyan('  Task Details'));
    console.log(chalk.dim(`  ID:      ${task.id || task._id}`));
    console.log(chalk.dim(`  Message: ${task.message}`));
    console.log(chalk.dim(`  Status:  ${task.status}`));
    console.log(
        chalk.dim(
            `  Created: ${task.createdAt ? new Date(task.createdAt).toLocaleString() : '-'}`
        )
    );
    if (task.description) {
        console.log(chalk.dim(`  Description: ${task.description}`));
    }
    if (task.deleteAt) {
        console.log(
            chalk.dim(
                `  Expires: ${formatExpiry(task.deleteAt)} -> ${new Date(task.deleteAt).toLocaleString()}`
            )
        );
    }
    if (files.length > 0) {
        console.log(chalk.dim(`  Files:   ${files.length}`));
    }
    console.log('');
}

function printTaskOpen(task) {
    const files = task.attachments || [];

    console.log('');
    console.log(chalk.cyan('  Task'));
    console.log(chalk.dim(`  ID: ${task.id || task._id}`));
    console.log(chalk.white.bold(`  ${task.message}`));
    console.log(chalk.dim(`  Status:  ${task.status}`));
    console.log(
        chalk.dim(`  Created: ${task.createdAt ? new Date(task.createdAt).toLocaleString() : '-'}`)
    );
    console.log(
        chalk.dim(`  Updated: ${task.updatedAt ? new Date(task.updatedAt).toLocaleString() : '-'}`)
    );

    if (task.description) {
        console.log('');
        console.log(chalk.cyan('  Description'));
        console.log(`  ${task.description}`);
    }

    if (task.deleteAt) {
        console.log('');
        console.log(chalk.cyan('  Auto Delete'));
        console.log(
            `  ${formatExpiry(task.deleteAt)} -> ${chalk.dim(new Date(task.deleteAt).toLocaleString())}`
        );
    }

    console.log('');
    console.log(chalk.cyan(`  Files (${files.length})`));
    if (files.length === 0) {
        console.log(chalk.dim('  No files attached yet. Use: texta upload <id> <file1> [file2...]'));
    } else {
        files.forEach((file, index) => {
            console.log(
                `  ${chalk.cyan(index + 1 + '.')} ${fileIcon(file.category, file.contentType)} ${chalk.white(file.name)} ${chalk.dim(`(${formatSize(file.size)})`)}`
            );
            console.log(`     ${chalk.dim(file.url)}`);
        });
        console.log('');
        console.log(chalk.dim('  Use `texta detach <id> <file-number>` to remove a file reference.'));
    }

    console.log('');
    console.log(chalk.dim(`  Commands for this task:`));
    console.log(chalk.dim(`    texta update ${task.id || task._id} --status done`));
    console.log(chalk.dim(`    texta upload ${task.id || task._id} <file1> [file2...]`));
    console.log(chalk.dim(`    texta delete ${task.id || task._id}`));
    console.log('');
}

module.exports = {
    banner,
    welcomeBanner,
    registeredBanner,
    success,
    error,
    info,
    warn,
    printTaskList,
    printTask,
    printTaskOpen,
};
