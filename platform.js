var getPlatform=function() {
	if (typeof ksanagap=="undefined") {
		try {
			var react_native=require("react-native");
			try {
				var OS=react_native.Platform.OS;
				if (OS==='android') {
					require("react-native-android-kdb");
					platform="react-native-android";					
				} else {
					platform="react-native-ios";	
				}
			} catch (e) {
				platform='chrome';
			}
		} catch (e) {
			if (typeof process=="undefined") {
				platform="chrome";
			} else {
				platform="node";		
			}
		}
	} else {
		platform=ksanagap.platform;
	}
	return platform;
}
module.exports={getPlatform:getPlatform};