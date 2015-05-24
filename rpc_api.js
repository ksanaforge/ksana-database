/**
	runs on node, 
*/

var kde=require("./kde");

var get=function(opts,cb) {
	var dbget=function(db){
			db.get(opts.key,{recursive:!!opts.recursive},function(data){
				cb(data);
			})		
	}

	var getshortname=function() {
		var splitted=opts.db.split("/");
		if (splitted.length==1) return opts.db;
		else return splitted[1];
	}
	kde.open(opts.db, function(err,db){
		if (err) {
			var shortname=getshortname();
			if (shortname!==opts.db) {
				kde.open(shortname,function(err,db2){ //try other folder
					if (err) {
						cb(null);//give up
					} else {
						dbget(db2);
					}
				})
			} else {
				cb(null);//give up
			}
			return;
		} else dbget(db);
	});
}
get.async=true;

var version=function() {
	return 2;
}
var list=function(opts,cb) {
	var out=require("./listkdb").sync().map(function(k){
		var relpath=k[1].match( /([^\/]+?\/[^\/]+?)\.kdb/)[1];
		return [k[0],relpath];
	});
	cb(out);
	return out;
}
list.async=true;
var rpc=function(service_holder) {
	service_holder["kde"]={get:get,version:version,list:list};
	console.log("install KDE rpc");
}
module.exports=rpc;