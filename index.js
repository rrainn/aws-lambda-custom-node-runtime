const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const axios = require('axios');
const version = require('utils/version_cleaner')(process.args[process.args.length - 1]);
const downloadURL = `https://nodejs.org/dist/v${version}/node-v${version}-linux-x64.tar.xz`;

async function main() {
	let runtimeFileNumber;
	while (fs.existsSync(path.join(`node_runtime${runtimeFileNumber ? `_${runtimeFileNumber}` : ""}.js`))) {
		if (runtimeFileNumber) {
			runtimeFileNumber++;
		} else {
			runtimeFileNumber = 0;
		}
	}
	const nodeRunnerFile = `node_runtime${runtimeFileNumber ? `_${runtimeFileNumber}` : ""}.js`;
	fs.copyFileSync(path.join(__dirname, 'templates', 'node_runtime.js'), path.join(nodeRunnerFile));
	fs.copyFileSync(path.join(__dirname, 'templates', 'bootstrap'), path.join(`bootstrap`));

	let bootstrap = fs.readFileSync(path.join(`bootstrap`), 'utf8').replace(/{{NODE_VERSION}}/g, version).replace(/{{NODE_VERSION}}/g, version).replace(/{{NODE_RUNNER_FILE}}/g, nodeRunnerFile);
	fs.writeFileSync(path.join(`bootstrap`), bootstrap);

	// Download Node.js
	try {
		await downloadFile(downloadURL, path.join(`node-v${version}-linux-x64.tar.xz`));
		await unzip(path.join(`node-v${version}-linux-x64.tar.xz`));
		fs.unlinkSync(path.join(`node-v${version}-linux-x64.tar.xz`));
	} catch (e) {
		console.error(e);
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
