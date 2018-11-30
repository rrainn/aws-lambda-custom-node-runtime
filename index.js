#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const axios = require('axios');
const colors = require('colors');
const version = require('./utils/version_cleaner')(process.argv[process.argv.length - 1]);
const downloadURL = `https://nodejs.org/dist/v${version}/node-v${version}-linux-x64.tar.xz`;

async function main() {
	let runtimeFileNumber;
	console.log("\nStep 1: Getting Runtime File Name");
	while (true) {
		if (!fs.existsSync(path.join(`node_runtime${runtimeFileNumber ? `_${runtimeFileNumber}` : ""}.js`))) {
			break;
		}
		if (runtimeFileNumber) {
			runtimeFileNumber++;
		} else {
			runtimeFileNumber = 1;
		}
	}
	const nodeRunnerFile = `node_runtime${runtimeFileNumber ? `_${runtimeFileNumber}` : ""}.js`;
	console.log(`✔ Got Runtime File Name: ${nodeRunnerFile}`.green);
	console.log("\nStep 2: Copying Template Files to Project Directory");
	fs.copyFileSync(path.join(__dirname, 'templates', 'node_runtime.js'), path.join(nodeRunnerFile));
	fs.copyFileSync(path.join(__dirname, 'templates', 'bootstrap'), path.join(`bootstrap`));
	console.log(`✔ Copied Template Files to Project Directory`.green);

	console.log("\nStep 3: Replacing Template Strings for bootstrap file");
	let bootstrap = fs.readFileSync(path.join(`bootstrap`), 'utf8').replace(/{{NODE_VERSION}}/g, version).replace(/{{NODE_VERSION}}/g, version).replace(/{{NODE_RUNNER_FILE}}/g, nodeRunnerFile);
	console.log(`✔ Replaced Template Strings for bootstrap file`.green);
	console.log("\nStep 4: Write new bootstrap file to disk");
	fs.writeFileSync(path.join(`bootstrap`), bootstrap);
	console.log(`✔ Wrote new bootstrap file to disk`.green);

	console.log("\nStep 5: Make bootstrap file executable");
	try {
		await makeExecutable(path.join(`bootstrap`));
		console.log(`✔ Made bootstrap file executable`.green);
	} catch (e) {
		console.error(`✖ Error making bootstrap file executable`.red);
		return;
	}

	// Download Node.js
	try {
		console.log("\nStep 6: Download Node.js");
		await downloadFile(downloadURL, path.join(`node-v${version}-linux-x64.tar.xz`));
		console.log(`✔ Downloaded Node.js`.green);
		console.log("\nStep 7: Unzip Node.js");
		await unzip(path.join(`node-v${version}-linux-x64.tar.xz`));
		console.log(`✔ Unzip Node.js`.green);
		console.log("\nStep 8: Deleting Unziped Node.js File");
		fs.unlinkSync(path.join(`node-v${version}-linux-x64.tar.xz`));
		console.log(`✔ Deleted Unziped Node.js File`.green);
	} catch (e) {
		console.error(`✖ Error`.red);
		throw e;
	}
}
main();


async function downloadFile(url, path) {
	const response = await axios({
		method: 'GET',
		url,
		responseType: 'stream'
	});

	response.data.pipe(fs.createWriteStream(path));

	return new Promise((resolve, reject) => {
		response.data.on('end', () => {
			resolve();
		});

		response.data.on('error', () => {
			reject();
		});
	});
}

async function unzip(file) {
	const { stdout, stderr } = await exec(`tar -xJf ${file}`);
}

async function makeExecutable(file) {
	const { stdout, stderr } = await exec(`chmod 755 ${file}`);
}
