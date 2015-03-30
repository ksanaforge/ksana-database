/* return array of dbid and absolute path*/
var listkdb_html5=function(cb,context) {
	ksana.runtime.html5fs.readdir(function(kdbs){
			cb.call(this,kdbs);
	},context||this);		
}

var listkdb_node=function(cb,context){
	var fs=require("fs");
	var path=require("path")
	var parent=path.resolve(process.cwd(),"..");
	var files=fs.readdirSync(parent);
	var output=[];
	files.map(function(f){
		var subdir=parent+path.sep+f;
		var stat=fs.statSync(subdir );
		if (stat.isDirectory()) {
			var subfiles=fs.readdirSync(subdir);
			for (var i=0;i<subfiles.length;i++) {
				var file=subfiles[i];
				var idx=file.indexOf(".kdb");
				if (idx>-1&&idx==file.length-4) {
					output.push([ file.substr(0,file.length-4), subdir+path.sep+file]);
				}
			}
		}
	})
	cb.call(context,output);
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
		formatapp(JSON.parse(kfs.listApps()));
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
	} else {
		listkdb_ksanagap(cb,context);
	}
}
module.exports=listkdb;