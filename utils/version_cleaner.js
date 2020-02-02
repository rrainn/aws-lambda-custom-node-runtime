module.exports = (version) => {
	version = version.replace(/^v/g, "");
	let versionArray = version.split(".");
	while (versionArray.length < 3) {
		versionArray.push("0");
	}
	return versionArray.join(".");
};
