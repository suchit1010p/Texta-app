#!/usr/bin/env node
// src/index.js

const { Command } = require('commander');
const chalk = require('chalk');
const { banner } = require('./ui');
const { loginCommand, registerCommand, logoutCommand } = require('./commands/auth');
const {
    listCommand,
    addCommand,
    viewCommand,
    openCommand,
    updateCommand,
    deleteCommand,
    uploadCommand,
    detachCommand,
} = require('./commands/tasks');
const { setBaseUrl, getBaseUrl } = require('./config');

const program = new Command();

program
    .name('texta')
    .description(chalk.cyan('texta') + ' — your smart task manager from the terminal')
    .version('1.0.0', '-v, --version', 'Show version');

// ─── REGISTER ─────────────────────────────────────────────────────────────────
program.command('register').description('Create a new texta account').action(registerCommand);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
program.command('login').description('Log in to your account').action(loginCommand);

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
program.command('logout').description('Log out').action(logoutCommand);

// ─── LIST ─────────────────────────────────────────────────────────────────────
program
    .command('list')
    .alias('ls')
    .description('List all tasks')
    .option('-s, --status <status>', 'Filter: pending | in-progress | done')
    .option('-q, --search <query>', 'Search by task text or description')
    .action((options) => listCommand(options));

// ─── ADD ──────────────────────────────────────────────────────────────────────
program
    .command('add <message>')
    .description('Add a new task')
    .option('-s, --status <status>', 'Initial status', 'pending')
    .action((message, options) => addCommand(message, options));

// ─── VIEW (compact) ───────────────────────────────────────────────────────────
program
    .command('view <ref>')
    .description('View a task — use # row number or full ID')
    .action((ref) => viewCommand(ref));

// ─── OPEN (full detail) ───────────────────────────────────────────────────────
program
    .command('open <ref>')
    .description('Open a task — full detail. Use # row number or full ID')
    .action((ref) => openCommand(ref));

// ─── UPDATE ───────────────────────────────────────────────────────────────────
program
    .command('update <ref>')
    .alias('edit')
    .description('Update a task — use # row number or full ID')
    .option('-m, --message <message>', 'New message text')
    .option('-s, --status <status>', 'New status: pending | in-progress | done')
    .action((ref, options) => updateCommand(ref, options));

// ─── DELETE ───────────────────────────────────────────────────────────────────
program
    .command('delete <ref> [more...]')
    .alias('rm')
    .description(
        'Delete one, multiple, or all tasks.\n' +
            '  texta delete 3            delete task #3\n' +
            '  texta delete 1 2 3        delete tasks #1 #2 #3  (space-separated)\n' +
            '  texta delete 2,3,4        delete tasks #2 #3 #4  (comma-separated)\n' +
            '  texta delete all          delete every task\n' +
            '  texta delete 3 2h         schedule auto-delete in 2 hours\n' +
            '  texta delete 3 --cancel   cancel scheduled delete'
    )
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--cancel', 'Cancel a scheduled auto-delete')
    .action((ref, more, options) => deleteCommand(ref, more, options));

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
program
    .command('upload <ref> [files...]')
    .description(
        'Upload one or more files to a task.\n' +
            '  Supports: images, PDFs, Word, Excel, PowerPoint, txt, zip, and more.\n\n' +
            '  Inline:      texta upload <id> photo.png report.pdf notes.docx\n' +
            '  Interactive: texta upload <id>   (paste Windows paths one per line)\n\n' +
            '  TIP: If you copied multiple paths from Windows Explorer,\n' +
            '  run `texta upload <id>` with no files and paste them all at once.'
    )
    .action((ref, files) => uploadCommand(ref, files));

// ─── DETACH ───────────────────────────────────────────────────────────────────
program
    .command('detach <ref> <fileRef>')
    .description(
        'Remove a single attached file reference from a task.\n' +
            '  Run `texta open <id>` to see file numbers.'
    )
    .action((ref, fileRef) => detachCommand(ref, fileRef));

// ─── CONFIG ───────────────────────────────────────────────────────────────────
program
    .command('config')
    .description('Configure texta settings')
    .option('--api-url <url>', 'Set backend API URL')
    .option('--show', 'Show current config')
    .action((options) => {
        if (options.apiUrl) {
            setBaseUrl(options.apiUrl);
            console.log(chalk.green('  ✔ ') + `API URL set to: ${options.apiUrl}`);
        }
        if (options.show) {
            console.log('');
            console.log(chalk.cyan('  Current Configuration:'));
            console.log(`  API URL: ${getBaseUrl()}`);
            console.log('');
        }
    });

// ─── HELP ─────────────────────────────────────────────────────────────────────
program.addHelpText('before', () => {
    banner();
    return '';
});
program.addHelpText(
    'after',
    `
${chalk.dim('Examples:')}
  ${chalk.cyan('$ texta register')}                                   Create account
  ${chalk.cyan('$ texta login')}                                      Log in
  ${chalk.cyan('$ texta add "Fix the bug"')}                          Add task
  ${chalk.cyan('$ texta list')}                                       List all tasks
  ${chalk.cyan('$ texta open 3')}                                       Open task #3 (full detail)
  ${chalk.cyan('$ texta upload 2 report.pdf photo.png')}                Upload files to task #2
  ${chalk.cyan('$ texta upload 2')}                                      Paste mode (Windows paths)
  ${chalk.cyan('$ texta detach 4 1')}                                    Remove first attached file from #4
  ${chalk.cyan('$ texta update 1 --status done')}                        Mark task #1 as done
  ${chalk.cyan('$ texta delete 5')}                                      Delete task #5
  ${chalk.cyan('$ texta delete 2,3,4')}                                  Delete tasks #2 #3 #4
  ${chalk.cyan('$ texta delete all')}                                     Delete every task
  ${chalk.cyan('$ texta delete 5 2h')}                                   Auto-delete task #5 in 2h
`
);

program.on('command:*', (ops) => {
    console.log(chalk.red(`\n  ✖ Unknown command: ${ops[0]}`));
    console.log(chalk.dim('  Run `texta --help` to see all commands.\n'));
    process.exit(1);
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    banner();
    program.outputHelp();
}
