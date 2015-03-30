var getPlatform=function() {
	if (typeof ksanagap=="undefined") {
		try {
			require("react-native");
			platform="react-native";
		} catch (e) {
			platform="node";	
		}
	} else {
		platform=ksanagap.platform;
	}
	return platform;
}
module.exports={getPlatform:getPlatform};