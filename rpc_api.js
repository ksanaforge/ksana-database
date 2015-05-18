/**
	runs on node, 
*/

var kde=require("./kde");

var get=function(opts,cb) {
	kde.open(opts.db, function(err,db){
		if (err) {
			cb(null);
			return;
		} else {
			db.get(opts.key,{recursive:!!opts.recursive},function(data){
				console.log(data.length);
				cb(data);
			})
		}
	});
}
var version=function() {
	return 2;
}
get.async=true;
var rpc=function(service_holder) {
	service_holder["kde"]={get:get,version:version};
	console.log("install rpc get");
}
module.exports=rpc;