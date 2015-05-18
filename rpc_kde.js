var host=require("./rpc");

var makeinf=function(name) {
	return (
		function(opts,callback) {
			host.exec(callback,0,"kde",name,opts);
		});
}

var API={};
//TODO , create a cache object on client side to save network trafic on
//same getRaw
API.get=makeinf("get");

//API.closeAll=makeinf("closeAll");
//exports.writeFile=writeFile;
//exports.initialize=makeinf("initialize");
//exports.version='0.0.13'; //this is a quick hack

host.exec(function(err,data){
	console.log('version',err,data)
	exports.version=data;
},0,"kde","version",{});


module.exports=API;