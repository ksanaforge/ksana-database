/* return array of dbid and absolute path*/
//var html5fs=require("./html5fs");

var listkdb_html5=function(cb,context) {
	kfs.readDir(function(kdbs){
			cb.call(this,kdbs);
	},context||this);		
}
var listkdb_rn_ios=function(cb,context) {
	cb(0,[]);
}
var listkdb_rn_android=function(cb,context) {
	/*
	kfs=require("react-native-android-kdb");	
	
	kfs.readDir(".",function(kdbs){
			cb.call(this,kdbs);
	},context||this);		
*/
	cb(0,[]);
}

var listkdb_rpc=function() {
	var fs=require("fs");
	var path=require("path");
	var dir=process.cwd();
	var files=fs.readdirSync(dir);
	var output=filterkdb(files,dir);
	return output;
}
var filterkdb=function(files,parent){
	var output=[];
	var fs=require("fs");
	var path=require("path");
	if (parent.length==3 && parent[1]==":") {
		return output;
	}
	files.map(function(f){
		var subdir=parent+path.sep+f;
		var stat=fs.statSync(subdir);
		if (stat.isDirectory()) {
			var subfiles=fs.readdirSync(subdir);
			for (var i=0;i<subfiles.length;i++) {
				var file=subfiles[i];
				var idx=file.indexOf(".kdb");
				if (idx>-1&&idx==file.length-4) {
					var fn=subdir+path.sep+file;
					fn=fn.replace(/\\/g,"/");
					output.push([ file.substr(0,file.length-4), fn]);
				}
			}
		}
	});
	return output;
}	


var listkdb_node=function(cb,context){
	var fs=require("fs");
	var path=require("path")
	var parent=path.resolve(process.cwd(),"..");
	var files=fs.readdirSync(parent);
	var output=filterkdb(files,parent);

	if (cb) cb.call(context,output);
	return output;
}
var fileNameOnly=function(fn) {
	var at=fn.lastIndexOf("/");
	if (at>-1) return fn.substr(at+1);
	return fn;
}
var listkdb_ksanagap=function(cb,context) {
	var output=[];

	var formatoutput=function(apps) {
		for (var i=0;i<apps.length;i++) {
			var app=apps[i];
			if (app.files) for (var j=0;j<app.files.length;j++) {
				var file=app.files[j];
				if (file.substr(file.length-4)==".kdb") {
					output.push([app.dbid,fileNameOnly(file)]);
				}
			}
		};	
		cb.call(context,output);	
	}
	if (kfs.listApps.length==1) {
		formatoutput(JSON.parse(kfs.listApps()));
	} else {
		kfs.listApps(function(apps){
			formatoutput(JSON.parse(apps));
		});
	}
}
var listkdb=function(cb,context) {
	var platform=require("./platform").getPlatform();
	var files=[];
	if (platform=="node" || platform=="node-webkit") {
		listkdb_node(cb,context);
	} else if (platform=="chrome") {
		listkdb_html5(cb,context);
	} else if (platform=="react-native-android"){
		listkdb_rn_android(cb,context);
	} else if (platform=="react-native-ios"){
		listkdb_rn_ios(cb,context);
	} else {
		listkdb_ksanagap(cb,context);
	}
}

listkdb.sync=listkdb_rpc;
module.exports=listkdb;