// src/commands/auth.js
const inquirer = require('inquirer');
const ora = require('ora');
const { login, register, logout } = require('../api');
const { setAuth, clearAuth, getUser } = require('../config');
const { welcomeBanner, success, error, info, registeredBanner } = require('../ui');

async function loginCommand() {
    console.log('');

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'identifier',
            message: 'username/email:',
            validate: (v) => v.trim() !== '' || 'Please enter your username or email',
        },
        {
            type: 'password',
            name: 'password',
            message: 'password:',
            mask: '*',
            validate: (v) => v.trim() !== '' || 'Please enter your password',
        },
    ]);

    const spinner = ora('Authenticating...').start();

    try {
        const data = await login(answers.identifier, answers.password);
        setAuth(data.accessToken, data.refreshToken, data.user);
        spinner.stop();
        welcomeBanner(data.user.username || data.user.email || answers.identifier);
        success('You are now logged in. Type `texta list` to get started.');
    } catch (err) {
        spinner.stop();
        const msg = err.response?.data?.message || err.message || 'Login failed';
        error(`Authentication failed: ${msg}`);
        process.exit(1);
    }
}

async function registerCommand() {
    console.log('');

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'username',
            message: 'username:',
            validate: (v) => {
                if (v.trim() === '') return 'Username is required';
                if (v.trim().length < 3) return 'Username must be at least 3 characters';
                if (!/^[a-zA-Z0-9_]+$/.test(v.trim()))
                    return 'Username can only contain letters, numbers and underscores';
                return true;
            },
        },
        {
            type: 'input',
            name: 'email',
            message: 'email:',
            validate: (v) => {
                if (v.trim() === '') return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
                    return 'Please enter a valid email address';
                return true;
            },
        },
        {
            type: 'password',
            name: 'password',
            message: 'password:',
            mask: '*',
            validate: (v) => {
                if (v.trim() === '') return 'Password is required';
                if (v.trim().length < 6) return 'Password must be at least 6 characters';
                return true;
            },
        },
        {
            type: 'password',
            name: 'confirmPassword',
            message: 'confirm password:',
            mask: '*',
            validate: (v, answers) => {
                if (v !== answers.password) return 'Passwords do not match';
                return true;
            },
        },
    ]);

    const spinner = ora('Creating your account...').start();

    try {
        const data = await register(answers.username, answers.email, answers.password);
        setAuth(data.accessToken, data.refreshToken, data.user);
        spinner.stop();
        registeredBanner(data.user.username || answers.username);
        success('Account created! You are now logged in.');
        info('Type `texta add "Your first task"` to get started.');
    } catch (err) {
        spinner.stop();
        const msg = err.response?.data?.message || err.message || 'Registration failed';
        error(`Could not create account: ${msg}`);
        process.exit(1);
    }
}

async function logoutCommand() {
    const user = getUser();
    try {
        await logout();
    } catch {
        // Clear local auth even if the server logout call fails.
    }
    clearAuth();
    if (user) {
        info(`Goodbye, ${user.username || user.email}! You have been logged out.`);
    } else {
        info('You have been logged out.');
    }
}

module.exports = { loginCommand, registerCommand, logoutCommand };
