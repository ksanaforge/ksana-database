(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"C:\\ksana2015\\node_modules\\ksana-database\\bsearch.js":[function(require,module,exports){
var indexOfSorted = function (array, obj, near) { 
  var low = 0,
  high = array.length;
  while (low < high) {
    var mid = (low + high) >> 1;
    if (array[mid]==obj) return mid;
    array[mid] < obj ? low = mid + 1 : high = mid;
  }
  if (near) return low;
  else if (array[low]==obj) return low;else return -1;
};
var indexOfSorted_str = function (array, obj, near) { 
  var low = 0,
  high = array.length;
  while (low < high) {
    var mid = (low + high) >> 1;
    if (array[mid]==obj) return mid;
    (array[mid].localeCompare(obj)<0) ? low = mid + 1 : high = mid;
  }
  if (near) return low;
  else if (array[low]==obj) return low;else return -1;
};


var bsearch=function(array,value,near) {
	var func=indexOfSorted;
	if (typeof array[0]=="string") func=indexOfSorted_str;
	return func(array,value,near);
}
var bsearchNear=function(array,value) {
	return bsearch(array,value,true);
}

module.exports=bsearch;//{bsearchNear:bsearchNear,bsearch:bsearch};
},{}],"C:\\ksana2015\\node_modules\\ksana-database\\index.js":[function(require,module,exports){
var KDE=require("./kde");
//currently only support node.js fs, ksanagap native fs, html5 file system
//use socket.io to read kdb from remote server in future
module.exports=KDE;
},{"./kde":"C:\\ksana2015\\node_modules\\ksana-database\\kde.js"}],"C:\\ksana2015\\node_modules\\ksana-database\\kde.js":[function(require,module,exports){
/* Ksana Database Engine

   2015/1/2 , 
   move to ksana-database
   simplified by removing document support and socket.io support


*/
var pool={},localPool={};
var apppath="";
var bsearch=require("./bsearch");
var Kdb=require('ksana-jsonrom');
var kdbs=[]; //available kdb , id and absolute path
var strsep="\uffff";
var kdblisted=false;
/*
var _getSync=function(paths,opts) {
	var out=[];
	for (var i in paths) {
		out.push(this.getSync(paths[i],opts));	
	}
	return out;
}
*/
var _gets=function(paths,opts,cb) { //get many data with one call
	if (!paths) return ;
	if (typeof paths=='string') {
		paths=[paths];
	}
	var engine=this, output=[];

	var makecb=function(path){
		return function(data){
				if (!(data && typeof data =='object' && data.__empty)) output.push(data);
				engine.get(path,opts,taskqueue.shift());
		};
	};

	var taskqueue=[];
	for (var i=0;i<paths.length;i++) {
		if (typeof paths[i]=="null") { //this is only a place holder for key data already in client cache
			output.push(null);
		} else {
			taskqueue.push(makecb(paths[i]));
		}
	};

	taskqueue.push(function(data){
		output.push(data);
		cb.apply(engine.context||engine,[output,paths]); //return to caller
	});

	taskqueue.shift()({__empty:true}); //run the task
}

var getFileRange=function(i) {
	var engine=this;

	var filePageCount=engine.get(["filePageCount"]);
	if (filePageCount) {
		if (i==0) {
			return {start:0,end:filePageCount[0]-1};
		} else {
			return {start:filePageCount[i-1],end:filePageCount[i]-1};
		}
	}

	//old buggy code
	var fileNames=engine.get(["fileNames"]);
	var fileOffsets=engine.get(["fileOffsets"]);
	var pageOffsets=engine.get(["pageOffsets"]);
	var pageNames=engine.get(["pageNames"]);
	var fileStart=fileOffsets[i], fileEnd=fileOffsets[i+1]-1;

	
	var start=bsearch(pageOffsets,fileStart,true);	
	//if (pageOffsets[start]==fileStart) start--;
	
	//work around for jiangkangyur
	while (pageNames[start+1]=="_") start++;

  //if (i==0) start=0; //work around for first file
	var end=bsearch(pageOffsets,fileEnd,true);
	return {start:start,end:end};
}

var getfp=function(absolutepage) {
	var fileOffsets=this.get(["fileOffsets"]);
	var pageOffsets=this.get(["pageOffsets"]);
	var pageoffset=pageOffsets[absolutepage];
	var file=bsearch(fileOffsets,pageoffset,true)-1;

	var fileStart=fileOffsets[file];
	var start=bsearch(pageOffsets,fileStart,true);	

	var page=absolutepage-start-1;
	return {file:file,page:page};
}
//return array of object of nfile npage given pagename
var findPage=function(pagename) {
	var pagenames=this.get("pageNames");
	var out=[];
	for (var i=0;i<pagenames.length;i++) {
		if (pagenames[i]==pagename) {
			var fp=getfp.apply(this,[i]);
			out.push({file:fp.file,page:fp.page,abspage:i});
		}
	}
	return out;
}
var getFilePageOffsets=function(i) {
	var pageOffsets=this.get("pageOffsets");
	var range=getFileRange.apply(this,[i]);
	return pageOffsets.slice(range.start,range.end+1);
}

var getFilePageNames=function(i) {
	var range=getFileRange.apply(this,[i]);
	var pageNames=this.get("pageNames");
	return pageNames.slice(range.start,range.end+1);
}
var localengine_get=function(path,opts,cb) {
	var engine=this;
	if (typeof opts=="function") {
		cb=opts;
		opts={recursive:false};
	}
	if (!path) {
		if (cb) cb(null);
		return null;
	}
	if (typeof cb!="function") {
		return engine.kdb.get(path,opts);
	}

	if (typeof path=="string") {
		return engine.kdb.get([path],opts,cb);
	} else if (typeof path[0] =="string") {
		return engine.kdb.get(path,opts,cb);
	} else if (typeof path[0] =="object") {
		return _gets.apply(engine,[path,opts,cb]);
	} else {
		cb(null);	
	}
};	

var getPreloadField=function(user) {
	var preload=[["meta"],["fileNames"],["fileOffsets"],["pageNames"],["pageOffsets"],["filePageCount"]];
	//["tokens"],["postingslen"] kse will load it
	if (user && user.length) { //user supply preload
		for (var i=0;i<user.length;i++) {
			if (preload.indexOf(user[i])==-1) {
				preload.push(user[i]);
			}
		}
	}
	return preload;
}
var createLocalEngine=function(kdb,opts,cb,context) {
	var engine={kdb:kdb, queryCache:{}, postingCache:{}, cache:{}};

	if (typeof context=="object") engine.context=context;
	engine.get=localengine_get;

	engine.fileOffset=fileOffset;
	engine.folderOffset=folderOffset;
	engine.pageOffset=pageOffset;
	engine.getFilePageNames=getFilePageNames;
	engine.getFilePageOffsets=getFilePageOffsets;
	engine.getFileRange=getFileRange;
	engine.findPage=findPage;
	//only local engine allow getSync
	//if (kdb.fs.getSync) engine.getSync=engine.kdb.getSync;
	
	//speedy native functions
	if (kdb.fs.mergePostings) {
		engine.mergePostings=kdb.fs.mergePostings.bind(kdb.fs);
	}
	
	var setPreload=function(res) {
		engine.dbname=res[0].name;
		//engine.customfunc=customfunc.getAPI(res[0].config);
		engine.ready=true;
	}

	var preload=getPreloadField(opts.preload);
	var opts={recursive:true};
	//if (typeof cb=="function") {
		_gets.apply(engine,[ preload, opts,function(res){
			setPreload(res);
			cb.apply(engine.context,[engine]);
		}]);
	//} else {
	//	setPreload(_getSync.apply(engine,[preload,opts]));
	//}
	return engine;
}

var pageOffset=function(pagename) {
	var engine=this;
	if (arguments.length>1) throw "argument : pagename ";

	var pageNames=engine.get("pageNames");
	var pageOffsets=engine.get("pageOffsets");

	var i=pageNames.indexOf(pagename);
	return (i>-1)?pageOffsets[i]:0;
}
var fileOffset=function(fn) {
	var engine=this;
	var filenames=engine.get("fileNames");
	var offsets=engine.get("fileOffsets");
	var i=filenames.indexOf(fn);
	if (i==-1) return null;
	return {start: offsets[i], end:offsets[i+1]};
}

var folderOffset=function(folder) {
	var engine=this;
	var start=0,end=0;
	var filenames=engine.get("fileNames");
	var offsets=engine.get("fileOffsets");
	for (var i=0;i<filenames.length;i++) {
		if (filenames[i].substring(0,folder.length)==folder) {
			if (!start) start=offsets[i];
			end=offsets[i];
		} else if (start) break;
	}
	return {start:start,end:end};
}

 //TODO delete directly from kdb instance
 //kdb.free();
var closeLocal=function(kdbid) {
	var engine=localPool[kdbid];
	if (engine) {
		engine.kdb.free();
		delete localPool[kdbid];
	}
}
var close=function(kdbid) {
	var engine=pool[kdbid];
	if (engine) {
		engine.kdb.free();
		delete pool[kdbid];
	}
}

var getLocalTries=function(kdbfn) {
	if (!kdblisted) {
		kdbs=require("./listkdb")();
		kdblisted=true;
	}

	var kdbid=kdbfn.replace('.kdb','');
	var tries= ["./"+kdbid+".kdb"
	           ,"../"+kdbid+".kdb"
	];

	for (var i=0;i<kdbs.length;i++) {
		if (kdbs[i][0]==kdbid) {
			tries.push(kdbs[i][1]);
		}
	}
	return tries;
}
var openLocalKsanagap=function(kdbid,opts,cb,context) {
	var engine=localPool[kdbid];
	if (engine) {
		if (cb) cb.apply(context||engine.context,[engine]);
		return engine;
	}

	var kdbfn=kdbid;
	var tries=getLocalTries(kdbfn);

	for (var i=0;i<tries.length;i++) {
		if (fs.existsSync(tries[i])) {
			//console.log("kdb path: "+nodeRequire('path').resolve(tries[i]));
			var kdb=new Kdb.open(tries[i],function(err,kdb){
				if (err) {
					cb.apply(context,[err]);
				} else {
					createLocalEngine(kdb,function(engine){
						localPool[kdbid]=engine;
						cb.apply(context||engine.context,[0,engine]);
					},context);
				}
			});
			return null;
		}
	}
	if (cb) cb.apply(context,[kdbid+" not found"]);
	return null;

}
var openLocalNode=function(kdbid,opts,cb,context) {
	var fs=require('fs');
	var engine=localPool[kdbid];
	if (engine) {
		if (cb) cb.apply(context||engine.context,[engine]);
		return engine;
	}
	var tries=getLocalTries(kdbid);

	for (var i=0;i<tries.length;i++) {
		if (fs.existsSync(tries[i])) {

			new Kdb.open(tries[i],function(err,kdb){
				if (err) {
					cb.apply(context||engine.content,[err]);
				} else {
					createLocalEngine(kdb,opts,function(engine){
							localPool[kdbid]=engine;
							cb.apply(context||engine.context,[0,engine]);
					},context);
				}
			});
			return engine;
		}
	}
	if (cb) cb.apply(context,[kdbid+" not found"]);
	return null;
}

var openLocalHtml5=function(kdbid,opts,cb,context) {	
	var engine=localPool[kdbid];
	if (engine) {
		if (cb) cb.apply(context||engine.context,[engine]);
		return engine;
	}
	var kdbfn=kdbid;
	if (kdbfn.indexOf(".kdb")==-1) kdbfn+=".kdb";
	new Kdb.open(kdbfn,function(err,handle){
		if (err) {
			cb.apply(context||engine.content,[err]);
		} else {
			createLocalEngine(handle,function(engine){
				localPool[kdbid]=engine;
				cb.apply(context||engine.context,[0,engine]);
			},context);
		}
	});
}
//omit cb for syncronize open
var openLocal=function(kdbid,opts,cb,context)  {
	if (typeof opts=="function") { //no opts
		if (typeof cb=="object") context=cb;
		cb=opts;
		opts={};
	}
	var platform=require("./platform").getPlatform();
	if (platform=="node-webkit" || platform=="node") {
		openLocalNode(kdbid,opts,cb,context);
	} else if (platform=="html5" || platform=="chrome"){
		openLocalHtml5(kdbid,opts,cb,context);		
	} else {
		openLocalKsanagap(kdbid,opts,cb,context);	
	}
}
var setPath=function(path) {
	apppath=path;
	console.log("set path",path)
}

var enumKdb=function(cb,context){
	return kdbs.map(function(k){return k[0]});
}

module.exports={open:openLocal,setPath:setPath, close:closeLocal, enumKdb:enumKdb};
},{"./bsearch":"C:\\ksana2015\\node_modules\\ksana-database\\bsearch.js","./listkdb":"C:\\ksana2015\\node_modules\\ksana-database\\listkdb.js","./platform":"C:\\ksana2015\\node_modules\\ksana-database\\platform.js","fs":false,"ksana-jsonrom":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\index.js"}],"C:\\ksana2015\\node_modules\\ksana-database\\listkdb.js":[function(require,module,exports){
/* return array of dbid and absolute path*/
var listkdb_html5=function() {
	throw "not implement yet";
	require("ksana-jsonrom").html5fs.readdir(function(kdbs){
			cb.apply(this,[kdbs]);
	},context||this);		

}

var listkdb_node=function(){
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
	return output;
}

var listkdb=function() {
	var platform=require("./platform").getPlatform();
	var files=[];
	if (platform=="node" || platform=="node-webkit") {
		files=listkdb_node();
	} else {
		throw "not implement yet";
	}
	return files;
}
module.exports=listkdb;
},{"./platform":"C:\\ksana2015\\node_modules\\ksana-database\\platform.js","fs":false,"ksana-jsonrom":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\index.js","path":false}],"C:\\ksana2015\\node_modules\\ksana-database\\platform.js":[function(require,module,exports){
var getPlatform=function() {
	if (typeof ksanagap=="undefined") {
		platform="node";
	} else {
		platform=ksanagap.platform;
	}
	return platform;
}
module.exports={getPlatform:getPlatform};
},{}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\html5fs.js":[function(require,module,exports){
/* emulate filesystem on html5 browser */
var read=function(handle,buffer,offset,length,position,cb) {//buffer and offset is not used
	var xhr = new XMLHttpRequest();
	xhr.open('GET', handle.url , true);
	var range=[position,length+position-1];
	xhr.setRequestHeader('Range', 'bytes='+range[0]+'-'+range[1]);
	xhr.responseType = 'arraybuffer';
	xhr.send();
	xhr.onload = function(e) {
		var that=this;
		setTimeout(function(){
			cb(0,that.response.byteLength,that.response);
		},0);
	}; 
}
var close=function(handle) {}
var fstatSync=function(handle) {
	throw "not implement yet";
}
var fstat=function(handle,cb) {
	throw "not implement yet";
}
var _open=function(fn_url,cb) {
		var handle={};
		if (fn_url.indexOf("filesystem:")==0){
			handle.url=fn_url;
			handle.fn=fn_url.substr( fn_url.lastIndexOf("/")+1);
		} else {
			handle.fn=fn_url;
			var url=API.files.filter(function(f){ return (f[0]==fn_url)});
			if (url.length) handle.url=url[0][1];
		}
		cb(handle);
}
var open=function(fn_url,cb) {
		if (!API.initialized) {init(1024*1024,function(){
			_open.apply(this,[fn_url,cb]);
		},this)} else _open.apply(this,[fn_url,cb]);
}
var load=function(filename,mode,cb) {
	open(filename,mode,cb,true);
}
var get_head=function(url,field,cb){
		var xhr = new XMLHttpRequest();
		xhr.open("HEAD", url, true);
		xhr.onreadystatechange = function() {
				if (this.readyState == this.DONE) {
					cb(xhr.getResponseHeader(field));
				} else {
					if (this.status!==200&&this.status!==206) {
						cb("");
					}
				}
		};
		xhr.send();	
}
var get_date=function(url,cb) {
		get_head(url,"Last-Modified",function(value){
			cb(value);
		});
}
var  getDownloadSize=function(url, cb) {
		get_head(url,"Content-Length",function(value){
			cb(parseInt(value));
		});
};
var checkUpdate=function(url,fn,cb) {
		if (!url) {
			cb(false);
			return;
		}
		get_date(url,function(d){
			API.fs.root.getFile(fn, {create: false, exclusive: false}, function(fileEntry) {
					fileEntry.getMetadata(function(metadata){
						var localDate=Date.parse(metadata.modificationTime);
						var urlDate=Date.parse(d);
						cb(urlDate>localDate);
					});
		},function(){
			cb(false);
		});
	});
}
var download=function(url,fn,cb,statuscb,context) {
	 var totalsize=0,batches=null,written=0;
	 var fileEntry=0, fileWriter=0;
	 var createBatches=function(size) {
			var bytes=1024*1024, out=[];
			var b=Math.floor(size / bytes);
			var last=size %bytes;
			for (var i=0;i<=b;i++) {
				out.push(i*bytes);
			}
			out.push(b*bytes+last);
			return out;
	 }
	 var finish=function() {
				 rm(fn,function(){
						fileEntry.moveTo(fileEntry.filesystem.root, fn,function(){
							setTimeout( cb.bind(context,false) , 0) ; 
						},function(e){
							console.log("failed",e)
						});
				 },this); 
	 }
		var tempfn="temp.kdb";
		var batch=function(b) {
			 var abort=false;
			 var xhr = new XMLHttpRequest();
			 var requesturl=url+"?"+Math.random();
			 xhr.open('get', requesturl, true);
			 xhr.setRequestHeader('Range', 'bytes='+batches[b]+'-'+(batches[b+1]-1));
			 xhr.responseType = 'blob';    
			 xhr.addEventListener('load', function() {
				 var blob=this.response;
				 fileEntry.createWriter(function(fileWriter) {
				 fileWriter.seek(fileWriter.length);
				 fileWriter.write(blob);
				 written+=blob.size;
				 fileWriter.onwriteend = function(e) {
					 if (statuscb) {
							abort=statuscb.apply(context,[ fileWriter.length / totalsize,totalsize ]);
							if (abort) setTimeout( cb.bind(context,false) , 0) ;
					 }
					 b++;
					 if (!abort) {
							if (b<batches.length-1) setTimeout(batch.bind(context,b),0);
							else                    finish();
					 }
				 };
				}, console.error);
			 },false);
			 xhr.send();
		}

		 getDownloadSize(url,function(size){
			 totalsize=size;
			 if (!size) {
					if (cb) cb.apply(context,[false]);
			 } else {//ready to download
				rm(tempfn,function(){
					 batches=createBatches(size);
					 if (statuscb) statuscb.apply(context,[ 0, totalsize ]);
					 API.fs.root.getFile(tempfn, {create: 1, exclusive: false}, function(_fileEntry) {
								fileEntry=_fileEntry;
							batch(0);
					 });
				},this);
			}
		});
}

var readFile=function(filename,cb,context) {
	API.fs.root.getFile(filename, function(fileEntry) {
			var reader = new FileReader();
			reader.onloadend = function(e) {
					if (cb) cb.apply(cb,[this.result]);
				};            
		}, console.error);
}
var writeFile=function(filename,buf,cb,context){
	 API.fs.root.getFile(filename, {create: true, exclusive: true}, function(fileEntry) {
			fileEntry.createWriter(function(fileWriter) {
				fileWriter.write(buf);
				fileWriter.onwriteend = function(e) {
					if (cb) cb.apply(cb,[buf.byteLength]);
				};            
			}, console.error);
		}, console.error);
}

var readdir=function(cb,context) {
	 var dirReader = API.fs.root.createReader();
	 var out=[],that=this;
		dirReader.readEntries(function(entries) {
			if (entries.length) {
					for (var i = 0, entry; entry = entries[i]; ++i) {
						if (entry.isFile) {
							out.push([entry.name,entry.toURL ? entry.toURL() : entry.toURI()]);
						}
					}
			}
			API.files=out;
			if (cb) cb.apply(context,[out]);
		}, function(){
			if (cb) cb.apply(context,[null]);
		});
}
var getFileURL=function(filename) {
	if (!API.files ) return null;
	var file= API.files.filter(function(f){return f[0]==filename});
	if (file.length) return file[0][1];
}
var rm=function(filename,cb,context) {
	 var url=getFileURL(filename);
	 if (url) rmURL(url,cb,context);
	 else if (cb) cb.apply(context,[false]);
}

var rmURL=function(filename,cb,context) {
		webkitResolveLocalFileSystemURL(filename, function(fileEntry) {
			fileEntry.remove(function() {
				if (cb) cb.apply(context,[true]);
			}, console.error);
		},  function(e){
			if (cb) cb.apply(context,[false]);//no such file
		});
}
function errorHandler(e) {
	console.error('Error: ' +e.name+ " "+e.message);
}
var initfs=function(grantedBytes,cb,context) {
	webkitRequestFileSystem(PERSISTENT, grantedBytes,  function(fs) {
		API.fs=fs;
		API.quota=grantedBytes;
		readdir(function(){
			API.initialized=true;
			cb.apply(context,[grantedBytes,fs]);
		},context);
	}, errorHandler);
}
var init=function(quota,cb,context) {
	navigator.webkitPersistentStorage.requestQuota(quota, 
			function(grantedBytes) {
				initfs(grantedBytes,cb,context);
		}, console.error 
	);
}
var queryQuota=function(cb,context) {
		var that=this;
		navigator.webkitPersistentStorage.queryUsageAndQuota( 
		 function(usage,quota){
				initfs(quota,function(){
					cb.apply(context,[usage,quota]);
				},context);
		});
}
var API={
	load:load
	,open:open
	,read:read
	,fstatSync:fstatSync
	,fstat:fstat,close:close
	,init:init
	,readdir:readdir
	,checkUpdate:checkUpdate
	,rm:rm
	,rmURL:rmURL
	,getFileURL:getFileURL
	,getDownloadSize:getDownloadSize
	,writeFile:writeFile
	,readFile:readFile
	,download:download
	,queryQuota:queryQuota
}
	module.exports=API;
},{}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\index.js":[function(require,module,exports){
module.exports={
	open:require("./kdb")
	,create:require("./kdbw")
	,html5fs:require("./html5fs")
}

},{"./html5fs":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\html5fs.js","./kdb":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdb.js","./kdbw":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbw.js"}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdb.js":[function(require,module,exports){
/*
	KDB version 3.0 GPL
	yapcheahshen@gmail.com
	2013/12/28
	asyncronize version of yadb

  remove dependency of Q, thanks to
  http://stackoverflow.com/questions/4234619/how-to-avoid-long-nesting-of-asynchronous-functions-in-node-js

  2015/1/2
  moved to ksanaforge/ksana-jsonrom
  add err in callback for node.js compliant
*/
var Kfs=null;

if (typeof ksanagap=="undefined") {
	Kfs=require('./kdbfs');			
} else {
	if (ksanagap.platform=="ios") {
		Kfs=require("./kdbfs_ios");
	} else if (ksanagap.platform=="node-webkit") {
		Kfs=require("./kdbfs");
	} else if (ksanagap.platform=="chrome") {
		Kfs=require("./kdbfs");
	} else {
		Kfs=require("./kdbfs_android");
	}
		
}


var DT={
	uint8:'1', //unsigned 1 byte integer
	int32:'4', // signed 4 bytes integer
	utf8:'8',  
	ucs2:'2',
	bool:'^', 
	blob:'&',
	utf8arr:'*', //shift of 8
	ucs2arr:'@', //shift of 2
	uint8arr:'!', //shift of 1
	int32arr:'$', //shift of 4
	vint:'`',
	pint:'~',	

	array:'\u001b',
	object:'\u001a' 
	//ydb start with object signature,
	//type a ydb in command prompt shows nothing
}
var verbose=0, readLog=function(){};
var _readLog=function(readtype,bytes) {
	console.log(readtype,bytes,"bytes");
}
if (verbose) readLog=_readLog;
var strsep="\uffff";
var Create=function(path,opts,cb) {
	/* loadxxx functions move file pointer */
	// load variable length int
	if (typeof opts=="function") {
		cb=opts;
		opts={};
	}

	
	var loadVInt =function(opts,blocksize,count,cb) {
		//if (count==0) return [];
		var that=this;

		this.fs.readBuf_packedint(opts.cur,blocksize,count,true,function(o){
			//console.log("vint");
			opts.cur+=o.adv;
			cb.apply(that,[o.data]);
		});
	}
	var loadVInt1=function(opts,cb) {
		var that=this;
		loadVInt.apply(this,[opts,6,1,function(data){
			//console.log("vint1");
			cb.apply(that,[data[0]]);
		}])
	}
	//for postings
	var loadPInt =function(opts,blocksize,count,cb) {
		var that=this;
		this.fs.readBuf_packedint(opts.cur,blocksize,count,false,function(o){
			//console.log("pint");
			opts.cur+=o.adv;
			cb.apply(that,[o.data]);
		});
	}
	// item can be any type (variable length)
	// maximum size of array is 1TB 2^40
	// structure:
	// signature,5 bytes offset, payload, itemlengths
	var getArrayLength=function(opts,cb) {
		var that=this;
		var dataoffset=0;

		this.fs.readUI8(opts.cur,function(len){
			var lengthoffset=len*4294967296;
			opts.cur++;
			that.fs.readUI32(opts.cur,function(len){
				opts.cur+=4;
				dataoffset=opts.cur; //keep this
				lengthoffset+=len;
				opts.cur+=lengthoffset;

				loadVInt1.apply(that,[opts,function(count){
					loadVInt.apply(that,[opts,count*6,count,function(sz){						
						cb({count:count,sz:sz,offset:dataoffset});
					}]);
				}]);
				
			});
		});
	}

	var loadArray = function(opts,blocksize,cb) {
		var that=this;
		getArrayLength.apply(this,[opts,function(L){
				var o=[];
				var endcur=opts.cur;
				opts.cur=L.offset;

				if (opts.lazy) { 
						var offset=L.offset;
						L.sz.map(function(sz){
							o[o.length]=strsep+offset.toString(16)
								   +strsep+sz.toString(16);
							offset+=sz;
						})
				} else {
					var taskqueue=[];
					for (var i=0;i<L.count;i++) {
						taskqueue.push(
							(function(sz){
								return (
									function(data){
										if (typeof data=='object' && data.__empty) {
											 //not pushing the first call
										}	else o.push(data);
										opts.blocksize=sz;
										load.apply(that,[opts, taskqueue.shift()]);
									}
								);
							})(L.sz[i])
						);
					}
					//last call to child load
					taskqueue.push(function(data){
						o.push(data);
						opts.cur=endcur;
						cb.apply(that,[o]);
					});
				}

				if (opts.lazy) cb.apply(that,[o]);
				else {
					taskqueue.shift()({__empty:true});
				}
			}
		])
	}		
	// item can be any type (variable length)
	// support lazy load
	// structure:
	// signature,5 bytes offset, payload, itemlengths, 
	//                    stringarray_signature, keys
	var loadObject = function(opts,blocksize,cb) {
		var that=this;
		var start=opts.cur;
		getArrayLength.apply(this,[opts,function(L) {
			opts.blocksize=blocksize-opts.cur+start;
			load.apply(that,[opts,function(keys){ //load the keys
				if (opts.keys) { //caller ask for keys
					keys.map(function(k) { opts.keys.push(k)});
				}

				var o={};
				var endcur=opts.cur;
				opts.cur=L.offset;
				if (opts.lazy) { 
					var offset=L.offset;
					for (var i=0;i<L.sz.length;i++) {
						//prefix with a \0, impossible for normal string
						o[keys[i]]=strsep+offset.toString(16)
							   +strsep+L.sz[i].toString(16);
						offset+=L.sz[i];
					}
				} else {
					var taskqueue=[];
					for (var i=0;i<L.count;i++) {
						taskqueue.push(
							(function(sz,key){
								return (
									function(data){
										if (typeof data=='object' && data.__empty) {
											//not saving the first call;
										} else {
											o[key]=data; 
										}
										opts.blocksize=sz;
										if (verbose) readLog("key",key);
										load.apply(that,[opts, taskqueue.shift()]);
									}
								);
							})(L.sz[i],keys[i-1])

						);
					}
					//last call to child load
					taskqueue.push(function(data){
						o[keys[keys.length-1]]=data;
						opts.cur=endcur;
						cb.apply(that,[o]);
					});
				}
				if (opts.lazy) cb.apply(that,[o]);
				else {
					taskqueue.shift()({__empty:true});
				}
			}]);
		}]);
	}

	//item is same known type
	var loadStringArray=function(opts,blocksize,encoding,cb) {
		var that=this;
		this.fs.readStringArray(opts.cur,blocksize,encoding,function(o){
			opts.cur+=blocksize;
			cb.apply(that,[o]);
		});
	}
	var loadIntegerArray=function(opts,blocksize,unitsize,cb) {
		var that=this;
		loadVInt1.apply(this,[opts,function(count){
			var o=that.fs.readFixedArray(opts.cur,count,unitsize,function(o){
				opts.cur+=count*unitsize;
				cb.apply(that,[o]);
			});
		}]);
	}
	var loadBlob=function(blocksize,cb) {
		var o=this.fs.readBuf(this.cur,blocksize);
		this.cur+=blocksize;
		return o;
	}	
	var loadbysignature=function(opts,signature,cb) {
		  var blocksize=opts.blocksize||this.fs.size; 
			opts.cur+=this.fs.signature_size;
			var datasize=blocksize-this.fs.signature_size;
			//basic types
			if (signature===DT.int32) {
				opts.cur+=4;
				this.fs.readI32(opts.cur-4,cb);
			} else if (signature===DT.uint8) {
				opts.cur++;
				this.fs.readUI8(opts.cur-1,cb);
			} else if (signature===DT.utf8) {
				var c=opts.cur;opts.cur+=datasize;
				this.fs.readString(c,datasize,'utf8',cb);
			} else if (signature===DT.ucs2) {
				var c=opts.cur;opts.cur+=datasize;
				this.fs.readString(c,datasize,'ucs2',cb);	
			} else if (signature===DT.bool) {
				opts.cur++;
				this.fs.readUI8(opts.cur-1,function(data){cb(!!data)});
			} else if (signature===DT.blob) {
				loadBlob(datasize,cb);
			}
			//variable length integers
			else if (signature===DT.vint) {
				loadVInt.apply(this,[opts,datasize,datasize,cb]);
			}
			else if (signature===DT.pint) {
				loadPInt.apply(this,[opts,datasize,datasize,cb]);
			}
			//simple array
			else if (signature===DT.utf8arr) {
				loadStringArray.apply(this,[opts,datasize,'utf8',cb]);
			}
			else if (signature===DT.ucs2arr) {
				loadStringArray.apply(this,[opts,datasize,'ucs2',cb]);
			}
			else if (signature===DT.uint8arr) {
				loadIntegerArray.apply(this,[opts,datasize,1,cb]);
			}
			else if (signature===DT.int32arr) {
				loadIntegerArray.apply(this,[opts,datasize,4,cb]);
			}
			//nested structure
			else if (signature===DT.array) {
				loadArray.apply(this,[opts,datasize,cb]);
			}
			else if (signature===DT.object) {
				loadObject.apply(this,[opts,datasize,cb]);
			}
			else {
				console.error('unsupported type',signature,opts)
				cb.apply(this,[null]);//make sure it return
				//throw 'unsupported type '+signature;
			}
	}

	var load=function(opts,cb) {
		opts=opts||{}; // this will served as context for entire load procedure
		opts.cur=opts.cur||0;
		var that=this;
		this.fs.readSignature(opts.cur, function(signature){
			loadbysignature.apply(that,[opts,signature,cb])
		});
		return this;
	}
	var CACHE=null;
	var KEY={};
	var ADDRESS={};
	var reset=function(cb) {
		if (!CACHE) {
			load.apply(this,[{cur:0,lazy:true},function(data){
				CACHE=data;
				cb.call(this);
			}]);	
		} else {
			cb.call(this);
		}
	}

	var exists=function(path,cb) {
		if (path.length==0) return true;
		var key=path.pop();
		var that=this;
		get.apply(this,[path,false,function(data){
			if (!path.join(strsep)) return (!!KEY[key]);
			var keys=KEY[path.join(strsep)];
			path.push(key);//put it back
			if (keys) cb.apply(that,[keys.indexOf(key)>-1]);
			else cb.apply(that,[false]);
		}]);
	}

	var getSync=function(path) {
		if (!CACHE) return undefined;	
		var o=CACHE;
		for (var i=0;i<path.length;i++) {
			var r=o[path[i]];
			if (typeof r=="undefined") return null;
			o=r;
		}
		return o;
	}
	var get=function(path,opts,cb) {
		if (typeof path=='undefined') path=[];
		if (typeof path=="string") path=[path];
		//opts.recursive=!!opts.recursive;
		if (typeof opts=="function") {
			cb=opts;node
			opts={};
		}
		var that=this;
		if (typeof cb!='function') return getSync(path);

		reset.apply(this,[function(){
			var o=CACHE;
			if (path.length==0) {
				if (opts.address) {
					cb([0,that.fs.size]);
				} else {
					cb(Object.keys(CACHE));	
				}
				return;
			} 
			
			var pathnow="",taskqueue=[],newopts={},r=null;
			var lastkey="";

			for (var i=0;i<path.length;i++) {
				var task=(function(key,k){

					return (function(data){
						if (!(typeof data=='object' && data.__empty)) {
							if (typeof o[lastkey]=='string' && o[lastkey][0]==strsep) o[lastkey]={};
							o[lastkey]=data; 
							o=o[lastkey];
							r=data[key];
							KEY[pathnow]=opts.keys;								
						} else {
							data=o[key];
							r=data;
						}

						if (typeof r==="undefined") {
							taskqueue=null;
							cb.apply(that,[r]); //return empty value
						} else {							
							if (parseInt(k)) pathnow+=strsep;
							pathnow+=key;
							if (typeof r=='string' && r[0]==strsep) { //offset of data to be loaded
								var p=r.substring(1).split(strsep).map(function(item){return parseInt(item,16)});
								var cur=p[0],sz=p[1];
								newopts.lazy=!opts.recursive || (k<path.length-1) ;
								newopts.blocksize=sz;newopts.cur=cur,newopts.keys=[];
								lastkey=key; //load is sync in android
								if (opts.address && taskqueue.length==1) {
									ADDRESS[pathnow]=[cur,sz];
									taskqueue.shift()(null,ADDRESS[pathnow]);
								} else {
									load.apply(that,[newopts, taskqueue.shift()]);
								}
							} else {
								if (opts.address && taskqueue.length==1) {
									taskqueue.shift()(null,ADDRESS[pathnow]);
								} else {
									taskqueue.shift().apply(that,[r]);
								}
							}
						}
					})
				})
				(path[i],i);
				
				taskqueue.push(task);
			}

			if (taskqueue.length==0) {
				cb.apply(that,[o]);
			} else {
				//last call to child load
				taskqueue.push(function(data,cursz){
					if (opts.address) {
						cb.apply(that,[cursz]);
					} else{
						var key=path[path.length-1];
						o[key]=data; KEY[pathnow]=opts.keys;
						cb.apply(that,[data]);
					}
				});
				taskqueue.shift()({__empty:true});			
			}

		}]); //reset
	}
	// get all keys in given path
	var getkeys=function(path,cb) {
		if (!path) path=[]
		var that=this;
		get.apply(this,[path,false,function(){
			if (path && path.length) {
				cb.apply(that,[KEY[path.join(strsep)]]);
			} else {
				cb.apply(that,[Object.keys(CACHE)]); 
				//top level, normally it is very small
			}
		}]);
	}

	var setupapi=function() {
		this.load=load;
//		this.cur=0;
		this.cache=function() {return CACHE};
		this.key=function() {return KEY};
		this.free=function() {
			CACHE=null;
			KEY=null;
			this.fs.free();
		}
		this.setCache=function(c) {CACHE=c};
		this.keys=getkeys;
		this.get=get;   // get a field, load if needed
		this.exists=exists;
		this.DT=DT;
		
		//install the sync version for node
		//if (typeof process!="undefined") require("./kdb_sync")(this);
		//if (cb) setTimeout(cb.bind(this),0);
		var that=this;
		var err=0;
		if (cb) {
			setTimeout(function(){
				cb(err,that);	
			},0);
		}
	}
	var that=this;
	var kfs=new Kfs(path,opts,function(err){
		if (err) {
			setTimeout(function(){
				cb(err,0);
			},0);
			return null;
		} else {
			that.size=this.size;
			setupapi.call(that);			
		}
	});
	this.fs=kfs;
	return this;
}

Create.datatypes=DT;

if (module) module.exports=Create;
//return Create;

},{"./kdbfs":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs.js","./kdbfs_android":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_android.js","./kdbfs_ios":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_ios.js"}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs.js":[function(require,module,exports){
/* node.js and html5 file system abstraction layer*/
try {
	var fs=require("fs");
	var Buffer=require("buffer").Buffer;
} catch (e) {
	var fs=require('./html5fs');
	var Buffer=function(){ return ""};
	var html5fs=true; 	
}
var signature_size=1;
var verbose=0, readLog=function(){};
var _readLog=function(readtype,bytes) {
	console.log(readtype,bytes,"bytes");
}
if (verbose) readLog=_readLog;

var unpack_int = function (ar, count , reset) {
   count=count||ar.length;
  var r = [], i = 0, v = 0;
  do {
	var shift = 0;
	do {
	  v += ((ar[i] & 0x7F) << shift);
	  shift += 7;	  
	} while (ar[++i] & 0x80);
	r.push(v); if (reset) v=0;
	count--;
  } while (i<ar.length && count);
  return {data:r, adv:i };
}
var Open=function(path,opts,cb) {
	opts=opts||{};

	var readSignature=function(pos,cb) {
		var buf=new Buffer(signature_size);
		var that=this;
		fs.read(this.handle,buf,0,signature_size,pos,function(err,len,buffer){
			if (html5fs) var signature=String.fromCharCode((new Uint8Array(buffer))[0])
			else var signature=buffer.toString('utf8',0,signature_size);
			cb.apply(that,[signature]);
		});
	}

	//this is quite slow
	//wait for StringView +ArrayBuffer to solve the problem
	//https://groups.google.com/a/chromium.org/forum/#!topic/blink-dev/ylgiNY_ZSV0
	//if the string is always ucs2
	//can use Uint16 to read it.
	//http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
	var decodeutf8 = function (utftext) {
		var string = "";
		var i = 0;
		var c=0,c1 = 0, c2 = 0 , c3=0;
		for (var i=0;i<utftext.length;i++) {
			if (utftext.charCodeAt(i)>127) break;
		}
		if (i>=utftext.length) return utftext;

		while ( i < utftext.length ) {
			c = utftext.charCodeAt(i);
			if (c < 128) {
				string += utftext[i];
				i++;
			} else if((c > 191) && (c < 224)) {
				c2 = utftext.charCodeAt(i+1);
				string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			} else {
				c2 = utftext.charCodeAt(i+1);
				c3 = utftext.charCodeAt(i+2);
				string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			}
		}
		return string;
	}

	var readString= function(pos,blocksize,encoding,cb) {
		encoding=encoding||'utf8';
		var buffer=new Buffer(blocksize);
		var that=this;
		fs.read(this.handle,buffer,0,blocksize,pos,function(err,len,buffer){
			readLog("string",len);
			if (html5fs) {
				if (encoding=='utf8') {
					var str=decodeutf8(String.fromCharCode.apply(null, new Uint8Array(buffer)))
				} else { //ucs2 is 3 times faster
					var str=String.fromCharCode.apply(null, new Uint16Array(buffer))	
				}
				
				cb.apply(that,[str]);
			} 
			else cb.apply(that,[buffer.toString(encoding)]);	
		});
	}

	//work around for chrome fromCharCode cannot accept huge array
	//https://code.google.com/p/chromium/issues/detail?id=56588
	var buf2stringarr=function(buf,enc) {
		if (enc=="utf8") 	var arr=new Uint8Array(buf);
		else var arr=new Uint16Array(buf);
		var i=0,codes=[],out=[],s="";
		while (i<arr.length) {
			if (arr[i]) {
				codes[codes.length]=arr[i];
			} else {
				s=String.fromCharCode.apply(null,codes);
				if (enc=="utf8") out[out.length]=decodeutf8(s);
				else out[out.length]=s;
				codes=[];				
			}
			i++;
		}
		
		s=String.fromCharCode.apply(null,codes);
		if (enc=="utf8") out[out.length]=decodeutf8(s);
		else out[out.length]=s;

		return out;
	}
	var readStringArray = function(pos,blocksize,encoding,cb) {
		var that=this,out=null;
		if (blocksize==0) return [];
		encoding=encoding||'utf8';
		var buffer=new Buffer(blocksize);
		fs.read(this.handle,buffer,0,blocksize,pos,function(err,len,buffer){
			if (html5fs) {
				readLog("stringArray",buffer.byteLength);

				if (encoding=='utf8') {
					out=buf2stringarr(buffer,"utf8");
				} else { //ucs2 is 3 times faster
					out=buf2stringarr(buffer,"ucs2");
				}
			} else {
				readLog("stringArray",buffer.length);
				out=buffer.toString(encoding).split('\0');
			} 	
			cb.apply(that,[out]);
		});
	}
	var readUI32=function(pos,cb) {
		var buffer=new Buffer(4);
		var that=this;
		fs.read(this.handle,buffer,0,4,pos,function(err,len,buffer){
			readLog("ui32",len);
			if (html5fs){
				//v=(new Uint32Array(buffer))[0];
				var v=new DataView(buffer).getUint32(0, false)
				cb(v);
			}
			else cb.apply(that,[buffer.readInt32BE(0)]);	
		});		
	}

	var readI32=function(pos,cb) {
		var buffer=new Buffer(4);
		var that=this;
		fs.read(this.handle,buffer,0,4,pos,function(err,len,buffer){
			readLog("i32",len);
			if (html5fs){
				var v=new DataView(buffer).getInt32(0, false)
				cb(v);
			}
			else  	cb.apply(that,[buffer.readInt32BE(0)]);	
		});
	}
	var readUI8=function(pos,cb) {
		var buffer=new Buffer(1);
		var that=this;

		fs.read(this.handle,buffer,0,1,pos,function(err,len,buffer){
			readLog("ui8",len);
			if (html5fs)cb( (new Uint8Array(buffer))[0]) ;
			else  			cb.apply(that,[buffer.readUInt8(0)]);	
			
		});
	}
	var readBuf=function(pos,blocksize,cb) {
		var that=this;
		var buf=new Buffer(blocksize);
		fs.read(this.handle,buf,0,blocksize,pos,function(err,len,buffer){
			readLog("buf",len);
			var buff=new Uint8Array(buffer)
			cb.apply(that,[buff]);
		});
	}
	var readBuf_packedint=function(pos,blocksize,count,reset,cb) {
		var that=this;
		readBuf.apply(this,[pos,blocksize,function(buffer){
			cb.apply(that,[unpack_int(buffer,count,reset)]);	
		}]);
		
	}
	var readFixedArray_html5fs=function(pos,count,unitsize,cb) {
		var func=null;
		if (unitsize===1) {
			func='getUint8';//Uint8Array;
		} else if (unitsize===2) {
			func='getUint16';//Uint16Array;
		} else if (unitsize===4) {
			func='getUint32';//Uint32Array;
		} else throw 'unsupported integer size';

		fs.read(this.handle,null,0,unitsize*count,pos,function(err,len,buffer){
			readLog("fix array",len);
			var out=[];
			if (unitsize==1) {
				out=new Uint8Array(buffer);
			} else {
				for (var i = 0; i < len / unitsize; i++) { //endian problem
				//	out.push( func(buffer,i*unitsize));
					out.push( v=new DataView(buffer)[func](i,false) );
				}
			}

			cb.apply(that,[out]);
		});
	}
	// signature, itemcount, payload
	var readFixedArray = function(pos ,count, unitsize,cb) {
		var func=null;
		var that=this;
		
		if (unitsize* count>this.size && this.size)  {
			console.log("array size exceed file size",this.size)
			return;
		}
		
		if (html5fs) return readFixedArray_html5fs.apply(this,[pos,count,unitsize,cb]);

		var items=new Buffer( unitsize* count);
		if (unitsize===1) {
			func=items.readUInt8;
		} else if (unitsize===2) {
			func=items.readUInt16BE;
		} else if (unitsize===4) {
			func=items.readUInt32BE;
		} else throw 'unsupported integer size';
		//console.log('itemcount',itemcount,'buffer',buffer);

		fs.read(this.handle,items,0,unitsize*count,pos,function(err,len,buffer){
			readLog("fix array",len);
			var out=[];
			for (var i = 0; i < items.length / unitsize; i++) {
				out.push( func.apply(items,[i*unitsize]));
			}
			cb.apply(that,[out]);
		});
	}

	var free=function() {
		//console.log('closing ',handle);
		fs.closeSync(this.handle);
	}
	var setupapi=function() {
		var that=this;
		this.readSignature=readSignature;
		this.readI32=readI32;
		this.readUI32=readUI32;
		this.readUI8=readUI8;
		this.readBuf=readBuf;
		this.readBuf_packedint=readBuf_packedint;
		this.readFixedArray=readFixedArray;
		this.readString=readString;
		this.readStringArray=readStringArray;
		this.signature_size=signature_size;
		this.free=free;
		if (html5fs) {
			var fn=path;
			if (path.indexOf("filesystem:")==0) fn=path.substr(path.lastIndexOf("/"));
			fs.fs.root.getFile(fn,{},function(entry){
			  entry.getMetadata(function(metadata) { 
				that.size=metadata.size;
				if (cb) setTimeout(cb.bind(that),0);
				});
			});
		} else {
			var stat=fs.fstatSync(this.handle);
			this.stat=stat;
			this.size=stat.size;		
			if (cb)	setTimeout(cb.bind(this,0),0);	
		}
	}

	var that=this;
	if (html5fs) {
		fs.open(path,function(h){
			that.handle=h;
			that.html5fs=true;
			setupapi.call(that);
			that.opened=true;
		})
	} else {
		if (fs.existsSync(path)){
			this.handle=fs.openSync(path,'r');//,function(err,handle){
			this.opened=true;
			setupapi.call(this);
		} else {
			if (cb)	setTimeout(cb.bind(null,"file not found:"+path),0);	
			return null;
		}
	}
	return this;
}
module.exports=Open;
},{"./html5fs":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\html5fs.js","buffer":false,"fs":false}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_android.js":[function(require,module,exports){
/*
  JAVA can only return Number and String
	array and buffer return in string format
	need JSON.parse
*/
var verbose=0;

var readSignature=function(pos,cb) {
	if (verbose) console.debug("read signature");
	var signature=kfs.readUTF8String(this.handle,pos,1);
	if (verbose) console.debug(signature,signature.charCodeAt(0));
	cb.apply(this,[signature]);
}
var readI32=function(pos,cb) {
	if (verbose) console.debug("read i32 at "+pos);
	var i32=kfs.readInt32(this.handle,pos);
	if (verbose) console.debug(i32);
	cb.apply(this,[i32]);	
}
var readUI32=function(pos,cb) {
	if (verbose) console.debug("read ui32 at "+pos);
	var ui32=kfs.readUInt32(this.handle,pos);
	if (verbose) console.debug(ui32);
	cb.apply(this,[ui32]);
}
var readUI8=function(pos,cb) {
	if (verbose) console.debug("read ui8 at "+pos); 
	var ui8=kfs.readUInt8(this.handle,pos);
	if (verbose) console.debug(ui8);
	cb.apply(this,[ui8]);
}
var readBuf=function(pos,blocksize,cb) {
	if (verbose) console.debug("read buffer at "+pos+ " blocksize "+blocksize);
	var buf=kfs.readBuf(this.handle,pos,blocksize);
	var buff=JSON.parse(buf);
	if (verbose) console.debug("buffer length"+buff.length);
	cb.apply(this,[buff]);	
}
var readBuf_packedint=function(pos,blocksize,count,reset,cb) {
	if (verbose) console.debug("read packed int at "+pos+" blocksize "+blocksize+" count "+count);
	var buf=kfs.readBuf_packedint(this.handle,pos,blocksize,count,reset);
	var adv=parseInt(buf);
	var buff=JSON.parse(buf.substr(buf.indexOf("[")));
	if (verbose) console.debug("packedInt length "+buff.length+" first item="+buff[0]);
	cb.apply(this,[{data:buff,adv:adv}]);	
}


var readString= function(pos,blocksize,encoding,cb) {
	if (verbose) console.debug("readstring at "+pos+" blocksize " +blocksize+" enc:"+encoding);
	if (encoding=="ucs2") {
		var str=kfs.readULE16String(this.handle,pos,blocksize);
	} else {
		var str=kfs.readUTF8String(this.handle,pos,blocksize);	
	}	 
	if (verbose) console.debug(str);
	cb.apply(this,[str]);	
}

var readFixedArray = function(pos ,count, unitsize,cb) {
	if (verbose) console.debug("read fixed array at "+pos+" count "+count+" unitsize "+unitsize); 
	var buf=kfs.readFixedArray(this.handle,pos,count,unitsize);
	var buff=JSON.parse(buf);
	if (verbose) console.debug("array length"+buff.length);
	cb.apply(this,[buff]);	
}
var readStringArray = function(pos,blocksize,encoding,cb) {
	if (verbose) console.log("read String array at "+pos+" blocksize "+blocksize +" enc "+encoding); 
	encoding = encoding||"utf8";
	var buf=kfs.readStringArray(this.handle,pos,blocksize,encoding);
	//var buff=JSON.parse(buf);
	if (verbose) console.debug("read string array");
	var buff=buf.split("\uffff"); //cannot return string with 0
	if (verbose) console.debug("array length"+buff.length);
	cb.apply(this,[buff]);	
}
var mergePostings=function(positions,cb) {
	var buf=kfs.mergePostings(this.handle,JSON.stringify(positions));
	if (!buf || buf.length==0) return [];
	else return JSON.parse(buf);
}

var free=function() {
	//console.log('closing ',handle);
	kfs.close(this.handle);
}
var Open=function(path,opts,cb) {
	opts=opts||{};
	var signature_size=1;
	var setupapi=function() { 
		this.readSignature=readSignature;
		this.readI32=readI32;
		this.readUI32=readUI32;
		this.readUI8=readUI8;
		this.readBuf=readBuf;
		this.readBuf_packedint=readBuf_packedint;
		this.readFixedArray=readFixedArray;
		this.readString=readString;
		this.readStringArray=readStringArray;
		this.signature_size=signature_size;
		this.mergePostings=mergePostings;
		this.free=free;
		this.size=kfs.getFileSize(this.handle);
		if (verbose) console.log("filesize  "+this.size);
		if (cb)	cb.call(this);
	}

	this.handle=kfs.open(path);
	this.opened=true;
	setupapi.call(this);
	return this;
}

module.exports=Open;
},{}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_ios.js":[function(require,module,exports){
/*
  JSContext can return all Javascript types.
*/
var verbose=1;

var readSignature=function(pos,cb) {
	if (verbose)  ksanagap.log("read signature at "+pos);
	var signature=kfs.readUTF8String(this.handle,pos,1);
	if (verbose)  ksanagap.log(signature+" "+signature.charCodeAt(0));
	cb.apply(this,[signature]);
}
var readI32=function(pos,cb) {
	if (verbose)  ksanagap.log("read i32 at "+pos);
	var i32=kfs.readInt32(this.handle,pos);
	if (verbose)  ksanagap.log(i32);
	cb.apply(this,[i32]);	
}
var readUI32=function(pos,cb) {
	if (verbose)  ksanagap.log("read ui32 at "+pos);
	var ui32=kfs.readUInt32(this.handle,pos);
	if (verbose)  ksanagap.log(ui32);
	cb.apply(this,[ui32]);
}
var readUI8=function(pos,cb) {
	if (verbose)  ksanagap.log("read ui8 at "+pos); 
	var ui8=kfs.readUInt8(this.handle,pos);
	if (verbose)  ksanagap.log(ui8);
	cb.apply(this,[ui8]);
}
var readBuf=function(pos,blocksize,cb) {
	if (verbose)  ksanagap.log("read buffer at "+pos);
	var buf=kfs.readBuf(this.handle,pos,blocksize);
	if (verbose)  ksanagap.log("buffer length"+buf.length);
	cb.apply(this,[buf]);	
}
var readBuf_packedint=function(pos,blocksize,count,reset,cb) {
	if (verbose)  ksanagap.log("read packed int fast, blocksize "+blocksize+" at "+pos);var t=new Date();
	var buf=kfs.readBuf_packedint(this.handle,pos,blocksize,count,reset);
	if (verbose)  ksanagap.log("return from packedint, time" + (new Date()-t));
	if (typeof buf.data=="string") {
		buf.data=eval("["+buf.data.substr(0,buf.data.length-1)+"]");
	}
	if (verbose)  ksanagap.log("unpacked length"+buf.data.length+" time" + (new Date()-t) );
	cb.apply(this,[buf]);
}


var readString= function(pos,blocksize,encoding,cb) {

	if (verbose)  ksanagap.log("readstring at "+pos+" blocksize "+blocksize+" "+encoding);var t=new Date();
	if (encoding=="ucs2") {
		var str=kfs.readULE16String(this.handle,pos,blocksize);
	} else {
		var str=kfs.readUTF8String(this.handle,pos,blocksize);	
	}
	if (verbose)  ksanagap.log(str+" time"+(new Date()-t));
	cb.apply(this,[str]);	
}

var readFixedArray = function(pos ,count, unitsize,cb) {
	if (verbose)  ksanagap.log("read fixed array at "+pos); var t=new Date();
	var buf=kfs.readFixedArray(this.handle,pos,count,unitsize);
	if (verbose)  ksanagap.log("array length "+buf.length+" time"+(new Date()-t));
	cb.apply(this,[buf]);	
}
var readStringArray = function(pos,blocksize,encoding,cb) {
	//if (verbose)  ksanagap.log("read String array "+blocksize +" "+encoding); 
	encoding = encoding||"utf8";
	if (verbose)  ksanagap.log("read string array at "+pos);var t=new Date();
	var buf=kfs.readStringArray(this.handle,pos,blocksize,encoding);
	if (typeof buf=="string") buf=buf.split("\0");
	//var buff=JSON.parse(buf);
	//var buff=buf.split("\uffff"); //cannot return string with 0
	if (verbose)  ksanagap.log("string array length"+buf.length+" time"+(new Date()-t));
	cb.apply(this,[buf]);
}

var mergePostings=function(positions) {
	var buf=kfs.mergePostings(this.handle,positions);
	if (typeof buf=="string") {
		buf=eval("["+buf.substr(0,buf.length-1)+"]");
	}
	return buf;
}
var free=function() {
	////if (verbose)  ksanagap.log('closing ',handle);
	kfs.close(this.handle);
}
var Open=function(path,opts,cb) {
	opts=opts||{};
	var signature_size=1;
	var setupapi=function() { 
		this.readSignature=readSignature;
		this.readI32=readI32;
		this.readUI32=readUI32;
		this.readUI8=readUI8;
		this.readBuf=readBuf;
		this.readBuf_packedint=readBuf_packedint;
		this.readFixedArray=readFixedArray;
		this.readString=readString;
		this.readStringArray=readStringArray;
		this.signature_size=signature_size;
		this.mergePostings=mergePostings;
		this.free=free;
		this.size=kfs.getFileSize(this.handle);
		if (verbose)  ksanagap.log("filesize  "+this.size);
		if (cb)	cb.call(this);
	}

	this.handle=kfs.open(path);
	this.opened=true;
	setupapi.call(this);
	return this;
}

module.exports=Open;
},{}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbw.js":[function(require,module,exports){
/*
  convert any json into a binary buffer
  the buffer can be saved with a single line of fs.writeFile
*/

var DT={
	uint8:'1', //unsigned 1 byte integer
	int32:'4', // signed 4 bytes integer
	utf8:'8',  
	ucs2:'2',
	bool:'^', 
	blob:'&',
	utf8arr:'*', //shift of 8
	ucs2arr:'@', //shift of 2
	uint8arr:'!', //shift of 1
	int32arr:'$', //shift of 4
	vint:'`',
	pint:'~',	

	array:'\u001b',
	object:'\u001a' 
	//ydb start with object signature,
	//type a ydb in command prompt shows nothing
}
var key_writing="";//for debugging
var pack_int = function (ar, savedelta) { // pack ar into
  if (!ar || ar.length === 0) return []; // empty array
  var r = [],
  i = 0,
  j = 0,
  delta = 0,
  prev = 0;
  
  do {
	delta = ar[i];
	if (savedelta) {
		delta -= prev;
	}
	if (delta < 0) {
	  console.trace('negative',prev,ar[i])
	  throw 'negetive';
	  break;
	}
	
	r[j++] = delta & 0x7f;
	delta >>= 7;
	while (delta > 0) {
	  r[j++] = (delta & 0x7f) | 0x80;
	  delta >>= 7;
	}
	prev = ar[i];
	i++;
  } while (i < ar.length);
  return r;
}
var Kfs=function(path,opts) {
	
	var handle=null;
	opts=opts||{};
	opts.size=opts.size||65536*2048; 
	console.log('kdb estimate size:',opts.size);
	var dbuf=new Buffer(opts.size);
	var cur=0;//dbuf cursor
	
	var writeSignature=function(value,pos) {
		dbuf.write(value,pos,value.length,'utf8');
		if (pos+value.length>cur) cur=pos+value.length;
		return value.length;
	}
	var writeOffset=function(value,pos) {
		dbuf.writeUInt8(Math.floor(value / (65536*65536)),pos);
		dbuf.writeUInt32BE( value & 0xFFFFFFFF,pos+1);
		if (pos+5>cur) cur=pos+5;
		return 5;
	}
	var writeString= function(value,pos,encoding) {
		encoding=encoding||'ucs2';
		if (value=="") throw "cannot write null string";
		if (encoding==='utf8')dbuf.write(DT.utf8,pos,1,'utf8');
		else if (encoding==='ucs2')dbuf.write(DT.ucs2,pos,1,'utf8');
		else throw 'unsupported encoding '+encoding;
			
		var len=Buffer.byteLength(value, encoding);
		dbuf.write(value,pos+1,len,encoding);
		
		if (pos+len+1>cur) cur=pos+len+1;
		return len+1; // signature
	}
	var writeStringArray = function(value,pos,encoding) {
		encoding=encoding||'ucs2';
		if (encoding==='utf8') dbuf.write(DT.utf8arr,pos,1,'utf8');
		else if (encoding==='ucs2')dbuf.write(DT.ucs2arr,pos,1,'utf8');
		else throw 'unsupported encoding '+encoding;
		
		var v=value.join('\0');
		var len=Buffer.byteLength(v, encoding);
		if (0===len) {
			throw "empty string array " + key_writing;
		}
		dbuf.write(v,pos+1,len,encoding);
		if (pos+len+1>cur) cur=pos+len+1;
		return len+1;
	}
	var writeI32=function(value,pos) {
		dbuf.write(DT.int32,pos,1,'utf8');
		dbuf.writeInt32BE(value,pos+1);
		if (pos+5>cur) cur=pos+5;
		return 5;
	}
	var writeUI8=function(value,pos) {
		dbuf.write(DT.uint8,pos,1,'utf8');
		dbuf.writeUInt8(value,pos+1);
		if (pos+2>cur) cur=pos+2;
		return 2;
	}
	var writeBool=function(value,pos) {
		dbuf.write(DT.bool,pos,1,'utf8');
		dbuf.writeUInt8(Number(value),pos+1);
		if (pos+2>cur) cur=pos+2;
		return 2;
	}		
	var writeBlob=function(value,pos) {
		dbuf.write(DT.blob,pos,1,'utf8');
		value.copy(dbuf, pos+1);
		var written=value.length+1;
		if (pos+written>cur) cur=pos+written;
		return written;
	}		
	/* no signature */
	var writeFixedArray = function(value,pos,unitsize) {
		//console.log('v.len',value.length,items.length,unitsize);
		if (unitsize===1) var func=dbuf.writeUInt8;
		else if (unitsize===4)var func=dbuf.writeInt32BE;
		else throw 'unsupported integer size';
		if (!value.length) {
			throw "empty fixed array "+key_writing;
		}
		for (var i = 0; i < value.length ; i++) {
			func.apply(dbuf,[value[i],i*unitsize+pos])
		}
		var len=unitsize*value.length;
		if (pos+len>cur) cur=pos+len;
		return len;
	}

	this.writeI32=writeI32;
	this.writeBool=writeBool;
	this.writeBlob=writeBlob;
	this.writeUI8=writeUI8;
	this.writeString=writeString;
	this.writeSignature=writeSignature;
	this.writeOffset=writeOffset; //5 bytes offset
	this.writeStringArray=writeStringArray;
	this.writeFixedArray=writeFixedArray;
	Object.defineProperty(this, "buf", {get : function(){ return dbuf; }});
	
	return this;
}

var Create=function(path,opts) {
	opts=opts||{};
	var kfs=new Kfs(path,opts);
	var cur=0;

	var handle={};
	
	//no signature
	var writeVInt =function(arr) {
		var o=pack_int(arr,false);
		kfs.writeFixedArray(o,cur,1);
		cur+=o.length;
	}
	var writeVInt1=function(value) {
		writeVInt([value]);
	}
	//for postings
	var writePInt =function(arr) {
		var o=pack_int(arr,true);
		kfs.writeFixedArray(o,cur,1);
		cur+=o.length;
	}
	
	var saveVInt = function(arr,key) {
		var start=cur;
		key_writing=key;
		cur+=kfs.writeSignature(DT.vint,cur);
		writeVInt(arr);
		var written = cur-start;
		pushitem(key,written);
		return written;		
	}
	var savePInt = function(arr,key) {
		var start=cur;
		key_writing=key;
		cur+=kfs.writeSignature(DT.pint,cur);
		writePInt(arr);
		var written = cur-start;
		pushitem(key,written);
		return written;	
	}

	
	var saveUI8 = function(value,key) {
		var written=kfs.writeUI8(value,cur);
		cur+=written;
		pushitem(key,written);
		return written;
	}
	var saveBool=function(value,key) {
		var written=kfs.writeBool(value,cur);
		cur+=written;
		pushitem(key,written);
		return written;
	}
	var saveI32 = function(value,key) {
		var written=kfs.writeI32(value,cur);
		cur+=written;
		pushitem(key,written);
		return written;
	}	
	var saveString = function(value,key,encoding) {
		encoding=encoding||stringencoding;
		key_writing=key;
		var written=kfs.writeString(value,cur,encoding);
		cur+=written;
		pushitem(key,written);
		return written;
	}
	var saveStringArray = function(arr,key,encoding) {
		encoding=encoding||stringencoding;
		key_writing=key;
		try {
			var written=kfs.writeStringArray(arr,cur,encoding);
		} catch(e) {
			throw e;
		}
		cur+=written;
		pushitem(key,written);
		return written;
	}
	
	var saveBlob = function(value,key) {
		key_writing=key;
		var written=kfs.writeBlob(value,cur);
		cur+=written;
		pushitem(key,written);
		return written;
	}

	var folders=[];
	var pushitem=function(key,written) {
		var folder=folders[folders.length-1];	
		if (!folder) return ;
		folder.itemslength.push(written);
		if (key) {
			if (!folder.keys) throw 'cannot have key in array';
			folder.keys.push(key);
		}
	}	
	var open = function(opt) {
		var start=cur;
		var key=opt.key || null;
		var type=opt.type||DT.array;
		cur+=kfs.writeSignature(type,cur);
		cur+=kfs.writeOffset(0x0,cur); // pre-alloc space for offset
		var folder={
			type:type, key:key,
			start:start,datastart:cur,
			itemslength:[] };
		if (type===DT.object) folder.keys=[];
		folders.push(folder);
	}
	var openObject = function(key) {
		open({type:DT.object,key:key});
	}
	var openArray = function(key) {
		open({type:DT.array,key:key});
	}
	var saveInts=function(arr,key,func) {
		func.apply(handle,[arr,key]);
	}
	var close = function(opt) {
		if (!folders.length) throw 'empty stack';
		var folder=folders.pop();
		//jump to lengths and keys
		kfs.writeOffset( cur-folder.datastart, folder.datastart-5);
		var itemcount=folder.itemslength.length;
		//save lengths
		writeVInt1(itemcount);
		writeVInt(folder.itemslength);
		
		if (folder.type===DT.object) {
			//use utf8 for keys
			cur+=kfs.writeStringArray(folder.keys,cur,'utf8');
		}
		written=cur-folder.start;
		pushitem(folder.key,written);
		return written;
	}
	
	
	var stringencoding='ucs2';
	var stringEncoding=function(newencoding) {
		if (newencoding) stringencoding=newencoding;
		else return stringencoding;
	}
	
	var allnumber_fast=function(arr) {
		if (arr.length<5) return allnumber(arr);
		if (typeof arr[0]=='number'
		    && Math.round(arr[0])==arr[0] && arr[0]>=0)
			return true;
		return false;
	}
	var allstring_fast=function(arr) {
		if (arr.length<5) return allstring(arr);
		if (typeof arr[0]=='string') return true;
		return false;
	}	
	var allnumber=function(arr) {
		for (var i=0;i<arr.length;i++) {
			if (typeof arr[i]!=='number') return false;
		}
		return true;
	}
	var allstring=function(arr) {
		for (var i=0;i<arr.length;i++) {
			if (typeof arr[i]!=='string') return false;
		}
		return true;
	}
	var getEncoding=function(key,encs) {
		var enc=encs[key];
		if (!enc) return null;
		if (enc=='delta' || enc=='posting') {
			return savePInt;
		} else if (enc=="variable") {
			return saveVInt;
		}
		return null;
	}
	var save=function(J,key,opts) {
		opts=opts||{};
		
		if (typeof J=="null" || typeof J=="undefined") {
			throw 'cannot save null value of ['+key+'] folders'+JSON.stringify(folders);
			return;
		}
		var type=J.constructor.name;
		if (type==='Object') {
			openObject(key);
			for (var i in J) {
				save(J[i],i,opts);
				if (opts.autodelete) delete J[i];
			}
			close();
		} else if (type==='Array') {
			if (allnumber_fast(J)) {
				if (J.sorted) { //number array is sorted
					saveInts(J,key,savePInt);	//posting delta format
				} else {
					saveInts(J,key,saveVInt);	
				}
			} else if (allstring_fast(J)) {
				saveStringArray(J,key);
			} else {
				openArray(key);
				for (var i=0;i<J.length;i++) {
					save(J[i],null,opts);
					if (opts.autodelete) delete J[i];
				}
				close();
			}
		} else if (type==='String') {
			saveString(J,key);
		} else if (type==='Number') {
			if (J>=0&&J<256) saveUI8(J,key);
			else saveI32(J,key);
		} else if (type==='Boolean') {
			saveBool(J,key);
		} else if (type==='Buffer') {
			saveBlob(J,key);
		} else {
			throw 'unsupported type '+type;
		}
	}
	
	var free=function() {
		while (folders.length) close();
		kfs.free();
	}
	var currentsize=function() {
		return cur;
	}

	Object.defineProperty(handle, "size", {get : function(){ return cur; }});

	var writeFile=function(fn,opts,cb) {
		if (typeof fs=="undefined") {
			var fs=opts.fs||require('fs');	
		}
		var totalbyte=handle.currentsize();
		var written=0,batch=0;
		
		if (typeof cb=="undefined" || typeof opts=="function") {
			cb=opts;
		}
		opts=opts||{};
		batchsize=opts.batchsize||1024*1024*16; //16 MB

		if (fs.existsSync(fn)) fs.unlinkSync(fn);

		var writeCb=function(total,written,cb,next) {
			return function(err) {
				if (err) throw "write error"+err;
				cb(total,written);
				batch++;
				next();
			}
		}

		var next=function() {
			if (batch<batches) {
				var bufstart=batchsize*batch;
				var bufend=bufstart+batchsize;
				if (bufend>totalbyte) bufend=totalbyte;
				var sliced=kfs.buf.slice(bufstart,bufend);
				written+=sliced.length;
				fs.appendFile(fn,sliced,writeCb(totalbyte,written, cb,next));
			}
		}
		var batches=1+Math.floor(handle.size/batchsize);
		next();
	}
	handle.free=free;
	handle.saveI32=saveI32;
	handle.saveUI8=saveUI8;
	handle.saveBool=saveBool;
	handle.saveString=saveString;
	handle.saveVInt=saveVInt;
	handle.savePInt=savePInt;
	handle.saveInts=saveInts;
	handle.saveBlob=saveBlob;
	handle.save=save;
	handle.openArray=openArray;
	handle.openObject=openObject;
	handle.stringEncoding=stringEncoding;
	//this.integerEncoding=integerEncoding;
	handle.close=close;
	handle.writeFile=writeFile;
	handle.currentsize=currentsize;
	return handle;
}

module.exports=Create;
},{"fs":false}]},{},["C:\\ksana2015\\node_modules\\ksana-database\\index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uXFwuLlxcLi5cXFVzZXJzXFxjaGVhaHNoZW5cXEFwcERhdGFcXFJvYW1pbmdcXG5wbVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJic2VhcmNoLmpzIiwiaW5kZXguanMiLCJrZGUuanMiLCJsaXN0a2RiLmpzIiwicGxhdGZvcm0uanMiLCIuLlxca3NhbmEtanNvbnJvbVxcaHRtbDVmcy5qcyIsIi4uXFxrc2FuYS1qc29ucm9tXFxpbmRleC5qcyIsIi4uXFxrc2FuYS1qc29ucm9tXFxrZGIuanMiLCIuLlxca3NhbmEtanNvbnJvbVxca2RiZnMuanMiLCIuLlxca3NhbmEtanNvbnJvbVxca2RiZnNfYW5kcm9pZC5qcyIsIi4uXFxrc2FuYS1qc29ucm9tXFxrZGJmc19pb3MuanMiLCIuLlxca3NhbmEtanNvbnJvbVxca2Ridy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGluZGV4T2ZTb3J0ZWQgPSBmdW5jdGlvbiAoYXJyYXksIG9iaiwgbmVhcikgeyBcclxuICB2YXIgbG93ID0gMCxcclxuICBoaWdoID0gYXJyYXkubGVuZ3RoO1xyXG4gIHdoaWxlIChsb3cgPCBoaWdoKSB7XHJcbiAgICB2YXIgbWlkID0gKGxvdyArIGhpZ2gpID4+IDE7XHJcbiAgICBpZiAoYXJyYXlbbWlkXT09b2JqKSByZXR1cm4gbWlkO1xyXG4gICAgYXJyYXlbbWlkXSA8IG9iaiA/IGxvdyA9IG1pZCArIDEgOiBoaWdoID0gbWlkO1xyXG4gIH1cclxuICBpZiAobmVhcikgcmV0dXJuIGxvdztcclxuICBlbHNlIGlmIChhcnJheVtsb3ddPT1vYmopIHJldHVybiBsb3c7ZWxzZSByZXR1cm4gLTE7XHJcbn07XHJcbnZhciBpbmRleE9mU29ydGVkX3N0ciA9IGZ1bmN0aW9uIChhcnJheSwgb2JqLCBuZWFyKSB7IFxyXG4gIHZhciBsb3cgPSAwLFxyXG4gIGhpZ2ggPSBhcnJheS5sZW5ndGg7XHJcbiAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcclxuICAgIHZhciBtaWQgPSAobG93ICsgaGlnaCkgPj4gMTtcclxuICAgIGlmIChhcnJheVttaWRdPT1vYmopIHJldHVybiBtaWQ7XHJcbiAgICAoYXJyYXlbbWlkXS5sb2NhbGVDb21wYXJlKG9iaik8MCkgPyBsb3cgPSBtaWQgKyAxIDogaGlnaCA9IG1pZDtcclxuICB9XHJcbiAgaWYgKG5lYXIpIHJldHVybiBsb3c7XHJcbiAgZWxzZSBpZiAoYXJyYXlbbG93XT09b2JqKSByZXR1cm4gbG93O2Vsc2UgcmV0dXJuIC0xO1xyXG59O1xyXG5cclxuXHJcbnZhciBic2VhcmNoPWZ1bmN0aW9uKGFycmF5LHZhbHVlLG5lYXIpIHtcclxuXHR2YXIgZnVuYz1pbmRleE9mU29ydGVkO1xyXG5cdGlmICh0eXBlb2YgYXJyYXlbMF09PVwic3RyaW5nXCIpIGZ1bmM9aW5kZXhPZlNvcnRlZF9zdHI7XHJcblx0cmV0dXJuIGZ1bmMoYXJyYXksdmFsdWUsbmVhcik7XHJcbn1cclxudmFyIGJzZWFyY2hOZWFyPWZ1bmN0aW9uKGFycmF5LHZhbHVlKSB7XHJcblx0cmV0dXJuIGJzZWFyY2goYXJyYXksdmFsdWUsdHJ1ZSk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzPWJzZWFyY2g7Ly97YnNlYXJjaE5lYXI6YnNlYXJjaE5lYXIsYnNlYXJjaDpic2VhcmNofTsiLCJ2YXIgS0RFPXJlcXVpcmUoXCIuL2tkZVwiKTtcclxuLy9jdXJyZW50bHkgb25seSBzdXBwb3J0IG5vZGUuanMgZnMsIGtzYW5hZ2FwIG5hdGl2ZSBmcywgaHRtbDUgZmlsZSBzeXN0ZW1cclxuLy91c2Ugc29ja2V0LmlvIHRvIHJlYWQga2RiIGZyb20gcmVtb3RlIHNlcnZlciBpbiBmdXR1cmVcclxubW9kdWxlLmV4cG9ydHM9S0RFOyIsIi8qIEtzYW5hIERhdGFiYXNlIEVuZ2luZVxyXG5cclxuICAgMjAxNS8xLzIgLCBcclxuICAgbW92ZSB0byBrc2FuYS1kYXRhYmFzZVxyXG4gICBzaW1wbGlmaWVkIGJ5IHJlbW92aW5nIGRvY3VtZW50IHN1cHBvcnQgYW5kIHNvY2tldC5pbyBzdXBwb3J0XHJcblxyXG5cclxuKi9cclxudmFyIHBvb2w9e30sbG9jYWxQb29sPXt9O1xyXG52YXIgYXBwcGF0aD1cIlwiO1xyXG52YXIgYnNlYXJjaD1yZXF1aXJlKFwiLi9ic2VhcmNoXCIpO1xyXG52YXIgS2RiPXJlcXVpcmUoJ2tzYW5hLWpzb25yb20nKTtcclxudmFyIGtkYnM9W107IC8vYXZhaWxhYmxlIGtkYiAsIGlkIGFuZCBhYnNvbHV0ZSBwYXRoXHJcbnZhciBzdHJzZXA9XCJcXHVmZmZmXCI7XHJcbnZhciBrZGJsaXN0ZWQ9ZmFsc2U7XHJcbi8qXHJcbnZhciBfZ2V0U3luYz1mdW5jdGlvbihwYXRocyxvcHRzKSB7XHJcblx0dmFyIG91dD1bXTtcclxuXHRmb3IgKHZhciBpIGluIHBhdGhzKSB7XHJcblx0XHRvdXQucHVzaCh0aGlzLmdldFN5bmMocGF0aHNbaV0sb3B0cykpO1x0XHJcblx0fVxyXG5cdHJldHVybiBvdXQ7XHJcbn1cclxuKi9cclxudmFyIF9nZXRzPWZ1bmN0aW9uKHBhdGhzLG9wdHMsY2IpIHsgLy9nZXQgbWFueSBkYXRhIHdpdGggb25lIGNhbGxcclxuXHRpZiAoIXBhdGhzKSByZXR1cm4gO1xyXG5cdGlmICh0eXBlb2YgcGF0aHM9PSdzdHJpbmcnKSB7XHJcblx0XHRwYXRocz1bcGF0aHNdO1xyXG5cdH1cclxuXHR2YXIgZW5naW5lPXRoaXMsIG91dHB1dD1bXTtcclxuXHJcblx0dmFyIG1ha2VjYj1mdW5jdGlvbihwYXRoKXtcclxuXHRcdHJldHVybiBmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0XHRpZiAoIShkYXRhICYmIHR5cGVvZiBkYXRhID09J29iamVjdCcgJiYgZGF0YS5fX2VtcHR5KSkgb3V0cHV0LnB1c2goZGF0YSk7XHJcblx0XHRcdFx0ZW5naW5lLmdldChwYXRoLG9wdHMsdGFza3F1ZXVlLnNoaWZ0KCkpO1xyXG5cdFx0fTtcclxuXHR9O1xyXG5cclxuXHR2YXIgdGFza3F1ZXVlPVtdO1xyXG5cdGZvciAodmFyIGk9MDtpPHBhdGhzLmxlbmd0aDtpKyspIHtcclxuXHRcdGlmICh0eXBlb2YgcGF0aHNbaV09PVwibnVsbFwiKSB7IC8vdGhpcyBpcyBvbmx5IGEgcGxhY2UgaG9sZGVyIGZvciBrZXkgZGF0YSBhbHJlYWR5IGluIGNsaWVudCBjYWNoZVxyXG5cdFx0XHRvdXRwdXQucHVzaChudWxsKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRhc2txdWV1ZS5wdXNoKG1ha2VjYihwYXRoc1tpXSkpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdHRhc2txdWV1ZS5wdXNoKGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0b3V0cHV0LnB1c2goZGF0YSk7XHJcblx0XHRjYi5hcHBseShlbmdpbmUuY29udGV4dHx8ZW5naW5lLFtvdXRwdXQscGF0aHNdKTsgLy9yZXR1cm4gdG8gY2FsbGVyXHJcblx0fSk7XHJcblxyXG5cdHRhc2txdWV1ZS5zaGlmdCgpKHtfX2VtcHR5OnRydWV9KTsgLy9ydW4gdGhlIHRhc2tcclxufVxyXG5cclxudmFyIGdldEZpbGVSYW5nZT1mdW5jdGlvbihpKSB7XHJcblx0dmFyIGVuZ2luZT10aGlzO1xyXG5cclxuXHR2YXIgZmlsZVBhZ2VDb3VudD1lbmdpbmUuZ2V0KFtcImZpbGVQYWdlQ291bnRcIl0pO1xyXG5cdGlmIChmaWxlUGFnZUNvdW50KSB7XHJcblx0XHRpZiAoaT09MCkge1xyXG5cdFx0XHRyZXR1cm4ge3N0YXJ0OjAsZW5kOmZpbGVQYWdlQ291bnRbMF0tMX07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4ge3N0YXJ0OmZpbGVQYWdlQ291bnRbaS0xXSxlbmQ6ZmlsZVBhZ2VDb3VudFtpXS0xfTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vb2xkIGJ1Z2d5IGNvZGVcclxuXHR2YXIgZmlsZU5hbWVzPWVuZ2luZS5nZXQoW1wiZmlsZU5hbWVzXCJdKTtcclxuXHR2YXIgZmlsZU9mZnNldHM9ZW5naW5lLmdldChbXCJmaWxlT2Zmc2V0c1wiXSk7XHJcblx0dmFyIHBhZ2VPZmZzZXRzPWVuZ2luZS5nZXQoW1wicGFnZU9mZnNldHNcIl0pO1xyXG5cdHZhciBwYWdlTmFtZXM9ZW5naW5lLmdldChbXCJwYWdlTmFtZXNcIl0pO1xyXG5cdHZhciBmaWxlU3RhcnQ9ZmlsZU9mZnNldHNbaV0sIGZpbGVFbmQ9ZmlsZU9mZnNldHNbaSsxXS0xO1xyXG5cclxuXHRcclxuXHR2YXIgc3RhcnQ9YnNlYXJjaChwYWdlT2Zmc2V0cyxmaWxlU3RhcnQsdHJ1ZSk7XHRcclxuXHQvL2lmIChwYWdlT2Zmc2V0c1tzdGFydF09PWZpbGVTdGFydCkgc3RhcnQtLTtcclxuXHRcclxuXHQvL3dvcmsgYXJvdW5kIGZvciBqaWFuZ2thbmd5dXJcclxuXHR3aGlsZSAocGFnZU5hbWVzW3N0YXJ0KzFdPT1cIl9cIikgc3RhcnQrKztcclxuXHJcbiAgLy9pZiAoaT09MCkgc3RhcnQ9MDsgLy93b3JrIGFyb3VuZCBmb3IgZmlyc3QgZmlsZVxyXG5cdHZhciBlbmQ9YnNlYXJjaChwYWdlT2Zmc2V0cyxmaWxlRW5kLHRydWUpO1xyXG5cdHJldHVybiB7c3RhcnQ6c3RhcnQsZW5kOmVuZH07XHJcbn1cclxuXHJcbnZhciBnZXRmcD1mdW5jdGlvbihhYnNvbHV0ZXBhZ2UpIHtcclxuXHR2YXIgZmlsZU9mZnNldHM9dGhpcy5nZXQoW1wiZmlsZU9mZnNldHNcIl0pO1xyXG5cdHZhciBwYWdlT2Zmc2V0cz10aGlzLmdldChbXCJwYWdlT2Zmc2V0c1wiXSk7XHJcblx0dmFyIHBhZ2VvZmZzZXQ9cGFnZU9mZnNldHNbYWJzb2x1dGVwYWdlXTtcclxuXHR2YXIgZmlsZT1ic2VhcmNoKGZpbGVPZmZzZXRzLHBhZ2VvZmZzZXQsdHJ1ZSktMTtcclxuXHJcblx0dmFyIGZpbGVTdGFydD1maWxlT2Zmc2V0c1tmaWxlXTtcclxuXHR2YXIgc3RhcnQ9YnNlYXJjaChwYWdlT2Zmc2V0cyxmaWxlU3RhcnQsdHJ1ZSk7XHRcclxuXHJcblx0dmFyIHBhZ2U9YWJzb2x1dGVwYWdlLXN0YXJ0LTE7XHJcblx0cmV0dXJuIHtmaWxlOmZpbGUscGFnZTpwYWdlfTtcclxufVxyXG4vL3JldHVybiBhcnJheSBvZiBvYmplY3Qgb2YgbmZpbGUgbnBhZ2UgZ2l2ZW4gcGFnZW5hbWVcclxudmFyIGZpbmRQYWdlPWZ1bmN0aW9uKHBhZ2VuYW1lKSB7XHJcblx0dmFyIHBhZ2VuYW1lcz10aGlzLmdldChcInBhZ2VOYW1lc1wiKTtcclxuXHR2YXIgb3V0PVtdO1xyXG5cdGZvciAodmFyIGk9MDtpPHBhZ2VuYW1lcy5sZW5ndGg7aSsrKSB7XHJcblx0XHRpZiAocGFnZW5hbWVzW2ldPT1wYWdlbmFtZSkge1xyXG5cdFx0XHR2YXIgZnA9Z2V0ZnAuYXBwbHkodGhpcyxbaV0pO1xyXG5cdFx0XHRvdXQucHVzaCh7ZmlsZTpmcC5maWxlLHBhZ2U6ZnAucGFnZSxhYnNwYWdlOml9KTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufVxyXG52YXIgZ2V0RmlsZVBhZ2VPZmZzZXRzPWZ1bmN0aW9uKGkpIHtcclxuXHR2YXIgcGFnZU9mZnNldHM9dGhpcy5nZXQoXCJwYWdlT2Zmc2V0c1wiKTtcclxuXHR2YXIgcmFuZ2U9Z2V0RmlsZVJhbmdlLmFwcGx5KHRoaXMsW2ldKTtcclxuXHRyZXR1cm4gcGFnZU9mZnNldHMuc2xpY2UocmFuZ2Uuc3RhcnQscmFuZ2UuZW5kKzEpO1xyXG59XHJcblxyXG52YXIgZ2V0RmlsZVBhZ2VOYW1lcz1mdW5jdGlvbihpKSB7XHJcblx0dmFyIHJhbmdlPWdldEZpbGVSYW5nZS5hcHBseSh0aGlzLFtpXSk7XHJcblx0dmFyIHBhZ2VOYW1lcz10aGlzLmdldChcInBhZ2VOYW1lc1wiKTtcclxuXHRyZXR1cm4gcGFnZU5hbWVzLnNsaWNlKHJhbmdlLnN0YXJ0LHJhbmdlLmVuZCsxKTtcclxufVxyXG52YXIgbG9jYWxlbmdpbmVfZ2V0PWZ1bmN0aW9uKHBhdGgsb3B0cyxjYikge1xyXG5cdHZhciBlbmdpbmU9dGhpcztcclxuXHRpZiAodHlwZW9mIG9wdHM9PVwiZnVuY3Rpb25cIikge1xyXG5cdFx0Y2I9b3B0cztcclxuXHRcdG9wdHM9e3JlY3Vyc2l2ZTpmYWxzZX07XHJcblx0fVxyXG5cdGlmICghcGF0aCkge1xyXG5cdFx0aWYgKGNiKSBjYihudWxsKTtcclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHRpZiAodHlwZW9mIGNiIT1cImZ1bmN0aW9uXCIpIHtcclxuXHRcdHJldHVybiBlbmdpbmUua2RiLmdldChwYXRoLG9wdHMpO1xyXG5cdH1cclxuXHJcblx0aWYgKHR5cGVvZiBwYXRoPT1cInN0cmluZ1wiKSB7XHJcblx0XHRyZXR1cm4gZW5naW5lLmtkYi5nZXQoW3BhdGhdLG9wdHMsY2IpO1xyXG5cdH0gZWxzZSBpZiAodHlwZW9mIHBhdGhbMF0gPT1cInN0cmluZ1wiKSB7XHJcblx0XHRyZXR1cm4gZW5naW5lLmtkYi5nZXQocGF0aCxvcHRzLGNiKTtcclxuXHR9IGVsc2UgaWYgKHR5cGVvZiBwYXRoWzBdID09XCJvYmplY3RcIikge1xyXG5cdFx0cmV0dXJuIF9nZXRzLmFwcGx5KGVuZ2luZSxbcGF0aCxvcHRzLGNiXSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGNiKG51bGwpO1x0XHJcblx0fVxyXG59O1x0XHJcblxyXG52YXIgZ2V0UHJlbG9hZEZpZWxkPWZ1bmN0aW9uKHVzZXIpIHtcclxuXHR2YXIgcHJlbG9hZD1bW1wibWV0YVwiXSxbXCJmaWxlTmFtZXNcIl0sW1wiZmlsZU9mZnNldHNcIl0sW1wicGFnZU5hbWVzXCJdLFtcInBhZ2VPZmZzZXRzXCJdLFtcImZpbGVQYWdlQ291bnRcIl1dO1xyXG5cdC8vW1widG9rZW5zXCJdLFtcInBvc3RpbmdzbGVuXCJdIGtzZSB3aWxsIGxvYWQgaXRcclxuXHRpZiAodXNlciAmJiB1c2VyLmxlbmd0aCkgeyAvL3VzZXIgc3VwcGx5IHByZWxvYWRcclxuXHRcdGZvciAodmFyIGk9MDtpPHVzZXIubGVuZ3RoO2krKykge1xyXG5cdFx0XHRpZiAocHJlbG9hZC5pbmRleE9mKHVzZXJbaV0pPT0tMSkge1xyXG5cdFx0XHRcdHByZWxvYWQucHVzaCh1c2VyW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gcHJlbG9hZDtcclxufVxyXG52YXIgY3JlYXRlTG9jYWxFbmdpbmU9ZnVuY3Rpb24oa2RiLG9wdHMsY2IsY29udGV4dCkge1xyXG5cdHZhciBlbmdpbmU9e2tkYjprZGIsIHF1ZXJ5Q2FjaGU6e30sIHBvc3RpbmdDYWNoZTp7fSwgY2FjaGU6e319O1xyXG5cclxuXHRpZiAodHlwZW9mIGNvbnRleHQ9PVwib2JqZWN0XCIpIGVuZ2luZS5jb250ZXh0PWNvbnRleHQ7XHJcblx0ZW5naW5lLmdldD1sb2NhbGVuZ2luZV9nZXQ7XHJcblxyXG5cdGVuZ2luZS5maWxlT2Zmc2V0PWZpbGVPZmZzZXQ7XHJcblx0ZW5naW5lLmZvbGRlck9mZnNldD1mb2xkZXJPZmZzZXQ7XHJcblx0ZW5naW5lLnBhZ2VPZmZzZXQ9cGFnZU9mZnNldDtcclxuXHRlbmdpbmUuZ2V0RmlsZVBhZ2VOYW1lcz1nZXRGaWxlUGFnZU5hbWVzO1xyXG5cdGVuZ2luZS5nZXRGaWxlUGFnZU9mZnNldHM9Z2V0RmlsZVBhZ2VPZmZzZXRzO1xyXG5cdGVuZ2luZS5nZXRGaWxlUmFuZ2U9Z2V0RmlsZVJhbmdlO1xyXG5cdGVuZ2luZS5maW5kUGFnZT1maW5kUGFnZTtcclxuXHQvL29ubHkgbG9jYWwgZW5naW5lIGFsbG93IGdldFN5bmNcclxuXHQvL2lmIChrZGIuZnMuZ2V0U3luYykgZW5naW5lLmdldFN5bmM9ZW5naW5lLmtkYi5nZXRTeW5jO1xyXG5cdFxyXG5cdC8vc3BlZWR5IG5hdGl2ZSBmdW5jdGlvbnNcclxuXHRpZiAoa2RiLmZzLm1lcmdlUG9zdGluZ3MpIHtcclxuXHRcdGVuZ2luZS5tZXJnZVBvc3RpbmdzPWtkYi5mcy5tZXJnZVBvc3RpbmdzLmJpbmQoa2RiLmZzKTtcclxuXHR9XHJcblx0XHJcblx0dmFyIHNldFByZWxvYWQ9ZnVuY3Rpb24ocmVzKSB7XHJcblx0XHRlbmdpbmUuZGJuYW1lPXJlc1swXS5uYW1lO1xyXG5cdFx0Ly9lbmdpbmUuY3VzdG9tZnVuYz1jdXN0b21mdW5jLmdldEFQSShyZXNbMF0uY29uZmlnKTtcclxuXHRcdGVuZ2luZS5yZWFkeT10cnVlO1xyXG5cdH1cclxuXHJcblx0dmFyIHByZWxvYWQ9Z2V0UHJlbG9hZEZpZWxkKG9wdHMucHJlbG9hZCk7XHJcblx0dmFyIG9wdHM9e3JlY3Vyc2l2ZTp0cnVlfTtcclxuXHQvL2lmICh0eXBlb2YgY2I9PVwiZnVuY3Rpb25cIikge1xyXG5cdFx0X2dldHMuYXBwbHkoZW5naW5lLFsgcHJlbG9hZCwgb3B0cyxmdW5jdGlvbihyZXMpe1xyXG5cdFx0XHRzZXRQcmVsb2FkKHJlcyk7XHJcblx0XHRcdGNiLmFwcGx5KGVuZ2luZS5jb250ZXh0LFtlbmdpbmVdKTtcclxuXHRcdH1dKTtcclxuXHQvL30gZWxzZSB7XHJcblx0Ly9cdHNldFByZWxvYWQoX2dldFN5bmMuYXBwbHkoZW5naW5lLFtwcmVsb2FkLG9wdHNdKSk7XHJcblx0Ly99XHJcblx0cmV0dXJuIGVuZ2luZTtcclxufVxyXG5cclxudmFyIHBhZ2VPZmZzZXQ9ZnVuY3Rpb24ocGFnZW5hbWUpIHtcclxuXHR2YXIgZW5naW5lPXRoaXM7XHJcblx0aWYgKGFyZ3VtZW50cy5sZW5ndGg+MSkgdGhyb3cgXCJhcmd1bWVudCA6IHBhZ2VuYW1lIFwiO1xyXG5cclxuXHR2YXIgcGFnZU5hbWVzPWVuZ2luZS5nZXQoXCJwYWdlTmFtZXNcIik7XHJcblx0dmFyIHBhZ2VPZmZzZXRzPWVuZ2luZS5nZXQoXCJwYWdlT2Zmc2V0c1wiKTtcclxuXHJcblx0dmFyIGk9cGFnZU5hbWVzLmluZGV4T2YocGFnZW5hbWUpO1xyXG5cdHJldHVybiAoaT4tMSk/cGFnZU9mZnNldHNbaV06MDtcclxufVxyXG52YXIgZmlsZU9mZnNldD1mdW5jdGlvbihmbikge1xyXG5cdHZhciBlbmdpbmU9dGhpcztcclxuXHR2YXIgZmlsZW5hbWVzPWVuZ2luZS5nZXQoXCJmaWxlTmFtZXNcIik7XHJcblx0dmFyIG9mZnNldHM9ZW5naW5lLmdldChcImZpbGVPZmZzZXRzXCIpO1xyXG5cdHZhciBpPWZpbGVuYW1lcy5pbmRleE9mKGZuKTtcclxuXHRpZiAoaT09LTEpIHJldHVybiBudWxsO1xyXG5cdHJldHVybiB7c3RhcnQ6IG9mZnNldHNbaV0sIGVuZDpvZmZzZXRzW2krMV19O1xyXG59XHJcblxyXG52YXIgZm9sZGVyT2Zmc2V0PWZ1bmN0aW9uKGZvbGRlcikge1xyXG5cdHZhciBlbmdpbmU9dGhpcztcclxuXHR2YXIgc3RhcnQ9MCxlbmQ9MDtcclxuXHR2YXIgZmlsZW5hbWVzPWVuZ2luZS5nZXQoXCJmaWxlTmFtZXNcIik7XHJcblx0dmFyIG9mZnNldHM9ZW5naW5lLmdldChcImZpbGVPZmZzZXRzXCIpO1xyXG5cdGZvciAodmFyIGk9MDtpPGZpbGVuYW1lcy5sZW5ndGg7aSsrKSB7XHJcblx0XHRpZiAoZmlsZW5hbWVzW2ldLnN1YnN0cmluZygwLGZvbGRlci5sZW5ndGgpPT1mb2xkZXIpIHtcclxuXHRcdFx0aWYgKCFzdGFydCkgc3RhcnQ9b2Zmc2V0c1tpXTtcclxuXHRcdFx0ZW5kPW9mZnNldHNbaV07XHJcblx0XHR9IGVsc2UgaWYgKHN0YXJ0KSBicmVhaztcclxuXHR9XHJcblx0cmV0dXJuIHtzdGFydDpzdGFydCxlbmQ6ZW5kfTtcclxufVxyXG5cclxuIC8vVE9ETyBkZWxldGUgZGlyZWN0bHkgZnJvbSBrZGIgaW5zdGFuY2VcclxuIC8va2RiLmZyZWUoKTtcclxudmFyIGNsb3NlTG9jYWw9ZnVuY3Rpb24oa2RiaWQpIHtcclxuXHR2YXIgZW5naW5lPWxvY2FsUG9vbFtrZGJpZF07XHJcblx0aWYgKGVuZ2luZSkge1xyXG5cdFx0ZW5naW5lLmtkYi5mcmVlKCk7XHJcblx0XHRkZWxldGUgbG9jYWxQb29sW2tkYmlkXTtcclxuXHR9XHJcbn1cclxudmFyIGNsb3NlPWZ1bmN0aW9uKGtkYmlkKSB7XHJcblx0dmFyIGVuZ2luZT1wb29sW2tkYmlkXTtcclxuXHRpZiAoZW5naW5lKSB7XHJcblx0XHRlbmdpbmUua2RiLmZyZWUoKTtcclxuXHRcdGRlbGV0ZSBwb29sW2tkYmlkXTtcclxuXHR9XHJcbn1cclxuXHJcbnZhciBnZXRMb2NhbFRyaWVzPWZ1bmN0aW9uKGtkYmZuKSB7XHJcblx0aWYgKCFrZGJsaXN0ZWQpIHtcclxuXHRcdGtkYnM9cmVxdWlyZShcIi4vbGlzdGtkYlwiKSgpO1xyXG5cdFx0a2RibGlzdGVkPXRydWU7XHJcblx0fVxyXG5cclxuXHR2YXIga2RiaWQ9a2RiZm4ucmVwbGFjZSgnLmtkYicsJycpO1xyXG5cdHZhciB0cmllcz0gW1wiLi9cIitrZGJpZCtcIi5rZGJcIlxyXG5cdCAgICAgICAgICAgLFwiLi4vXCIra2RiaWQrXCIua2RiXCJcclxuXHRdO1xyXG5cclxuXHRmb3IgKHZhciBpPTA7aTxrZGJzLmxlbmd0aDtpKyspIHtcclxuXHRcdGlmIChrZGJzW2ldWzBdPT1rZGJpZCkge1xyXG5cdFx0XHR0cmllcy5wdXNoKGtkYnNbaV1bMV0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gdHJpZXM7XHJcbn1cclxudmFyIG9wZW5Mb2NhbEtzYW5hZ2FwPWZ1bmN0aW9uKGtkYmlkLG9wdHMsY2IsY29udGV4dCkge1xyXG5cdHZhciBlbmdpbmU9bG9jYWxQb29sW2tkYmlkXTtcclxuXHRpZiAoZW5naW5lKSB7XHJcblx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHR8fGVuZ2luZS5jb250ZXh0LFtlbmdpbmVdKTtcclxuXHRcdHJldHVybiBlbmdpbmU7XHJcblx0fVxyXG5cclxuXHR2YXIga2RiZm49a2RiaWQ7XHJcblx0dmFyIHRyaWVzPWdldExvY2FsVHJpZXMoa2RiZm4pO1xyXG5cclxuXHRmb3IgKHZhciBpPTA7aTx0cmllcy5sZW5ndGg7aSsrKSB7XHJcblx0XHRpZiAoZnMuZXhpc3RzU3luYyh0cmllc1tpXSkpIHtcclxuXHRcdFx0Ly9jb25zb2xlLmxvZyhcImtkYiBwYXRoOiBcIitub2RlUmVxdWlyZSgncGF0aCcpLnJlc29sdmUodHJpZXNbaV0pKTtcclxuXHRcdFx0dmFyIGtkYj1uZXcgS2RiLm9wZW4odHJpZXNbaV0sZnVuY3Rpb24oZXJyLGtkYil7XHJcblx0XHRcdFx0aWYgKGVycikge1xyXG5cdFx0XHRcdFx0Y2IuYXBwbHkoY29udGV4dCxbZXJyXSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNyZWF0ZUxvY2FsRW5naW5lKGtkYixmdW5jdGlvbihlbmdpbmUpe1xyXG5cdFx0XHRcdFx0XHRsb2NhbFBvb2xba2RiaWRdPWVuZ2luZTtcclxuXHRcdFx0XHRcdFx0Y2IuYXBwbHkoY29udGV4dHx8ZW5naW5lLmNvbnRleHQsWzAsZW5naW5lXSk7XHJcblx0XHRcdFx0XHR9LGNvbnRleHQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW2tkYmlkK1wiIG5vdCBmb3VuZFwiXSk7XHJcblx0cmV0dXJuIG51bGw7XHJcblxyXG59XHJcbnZhciBvcGVuTG9jYWxOb2RlPWZ1bmN0aW9uKGtkYmlkLG9wdHMsY2IsY29udGV4dCkge1xyXG5cdHZhciBmcz1yZXF1aXJlKCdmcycpO1xyXG5cdHZhciBlbmdpbmU9bG9jYWxQb29sW2tkYmlkXTtcclxuXHRpZiAoZW5naW5lKSB7XHJcblx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHR8fGVuZ2luZS5jb250ZXh0LFtlbmdpbmVdKTtcclxuXHRcdHJldHVybiBlbmdpbmU7XHJcblx0fVxyXG5cdHZhciB0cmllcz1nZXRMb2NhbFRyaWVzKGtkYmlkKTtcclxuXHJcblx0Zm9yICh2YXIgaT0wO2k8dHJpZXMubGVuZ3RoO2krKykge1xyXG5cdFx0aWYgKGZzLmV4aXN0c1N5bmModHJpZXNbaV0pKSB7XHJcblxyXG5cdFx0XHRuZXcgS2RiLm9wZW4odHJpZXNbaV0sZnVuY3Rpb24oZXJyLGtkYil7XHJcblx0XHRcdFx0aWYgKGVycikge1xyXG5cdFx0XHRcdFx0Y2IuYXBwbHkoY29udGV4dHx8ZW5naW5lLmNvbnRlbnQsW2Vycl0pO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjcmVhdGVMb2NhbEVuZ2luZShrZGIsb3B0cyxmdW5jdGlvbihlbmdpbmUpe1xyXG5cdFx0XHRcdFx0XHRcdGxvY2FsUG9vbFtrZGJpZF09ZW5naW5lO1xyXG5cdFx0XHRcdFx0XHRcdGNiLmFwcGx5KGNvbnRleHR8fGVuZ2luZS5jb250ZXh0LFswLGVuZ2luZV0pO1xyXG5cdFx0XHRcdFx0fSxjb250ZXh0KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRyZXR1cm4gZW5naW5lO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW2tkYmlkK1wiIG5vdCBmb3VuZFwiXSk7XHJcblx0cmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbnZhciBvcGVuTG9jYWxIdG1sNT1mdW5jdGlvbihrZGJpZCxvcHRzLGNiLGNvbnRleHQpIHtcdFxyXG5cdHZhciBlbmdpbmU9bG9jYWxQb29sW2tkYmlkXTtcclxuXHRpZiAoZW5naW5lKSB7XHJcblx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHR8fGVuZ2luZS5jb250ZXh0LFtlbmdpbmVdKTtcclxuXHRcdHJldHVybiBlbmdpbmU7XHJcblx0fVxyXG5cdHZhciBrZGJmbj1rZGJpZDtcclxuXHRpZiAoa2RiZm4uaW5kZXhPZihcIi5rZGJcIik9PS0xKSBrZGJmbis9XCIua2RiXCI7XHJcblx0bmV3IEtkYi5vcGVuKGtkYmZuLGZ1bmN0aW9uKGVycixoYW5kbGUpe1xyXG5cdFx0aWYgKGVycikge1xyXG5cdFx0XHRjYi5hcHBseShjb250ZXh0fHxlbmdpbmUuY29udGVudCxbZXJyXSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRjcmVhdGVMb2NhbEVuZ2luZShoYW5kbGUsZnVuY3Rpb24oZW5naW5lKXtcclxuXHRcdFx0XHRsb2NhbFBvb2xba2RiaWRdPWVuZ2luZTtcclxuXHRcdFx0XHRjYi5hcHBseShjb250ZXh0fHxlbmdpbmUuY29udGV4dCxbMCxlbmdpbmVdKTtcclxuXHRcdFx0fSxjb250ZXh0KTtcclxuXHRcdH1cclxuXHR9KTtcclxufVxyXG4vL29taXQgY2IgZm9yIHN5bmNyb25pemUgb3BlblxyXG52YXIgb3BlbkxvY2FsPWZ1bmN0aW9uKGtkYmlkLG9wdHMsY2IsY29udGV4dCkgIHtcclxuXHRpZiAodHlwZW9mIG9wdHM9PVwiZnVuY3Rpb25cIikgeyAvL25vIG9wdHNcclxuXHRcdGlmICh0eXBlb2YgY2I9PVwib2JqZWN0XCIpIGNvbnRleHQ9Y2I7XHJcblx0XHRjYj1vcHRzO1xyXG5cdFx0b3B0cz17fTtcclxuXHR9XHJcblx0dmFyIHBsYXRmb3JtPXJlcXVpcmUoXCIuL3BsYXRmb3JtXCIpLmdldFBsYXRmb3JtKCk7XHJcblx0aWYgKHBsYXRmb3JtPT1cIm5vZGUtd2Via2l0XCIgfHwgcGxhdGZvcm09PVwibm9kZVwiKSB7XHJcblx0XHRvcGVuTG9jYWxOb2RlKGtkYmlkLG9wdHMsY2IsY29udGV4dCk7XHJcblx0fSBlbHNlIGlmIChwbGF0Zm9ybT09XCJodG1sNVwiIHx8IHBsYXRmb3JtPT1cImNocm9tZVwiKXtcclxuXHRcdG9wZW5Mb2NhbEh0bWw1KGtkYmlkLG9wdHMsY2IsY29udGV4dCk7XHRcdFxyXG5cdH0gZWxzZSB7XHJcblx0XHRvcGVuTG9jYWxLc2FuYWdhcChrZGJpZCxvcHRzLGNiLGNvbnRleHQpO1x0XHJcblx0fVxyXG59XHJcbnZhciBzZXRQYXRoPWZ1bmN0aW9uKHBhdGgpIHtcclxuXHRhcHBwYXRoPXBhdGg7XHJcblx0Y29uc29sZS5sb2coXCJzZXQgcGF0aFwiLHBhdGgpXHJcbn1cclxuXHJcbnZhciBlbnVtS2RiPWZ1bmN0aW9uKGNiLGNvbnRleHQpe1xyXG5cdHJldHVybiBrZGJzLm1hcChmdW5jdGlvbihrKXtyZXR1cm4ga1swXX0pO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cz17b3BlbjpvcGVuTG9jYWwsc2V0UGF0aDpzZXRQYXRoLCBjbG9zZTpjbG9zZUxvY2FsLCBlbnVtS2RiOmVudW1LZGJ9OyIsIi8qIHJldHVybiBhcnJheSBvZiBkYmlkIGFuZCBhYnNvbHV0ZSBwYXRoKi9cclxudmFyIGxpc3RrZGJfaHRtbDU9ZnVuY3Rpb24oKSB7XHJcblx0dGhyb3cgXCJub3QgaW1wbGVtZW50IHlldFwiO1xyXG5cdHJlcXVpcmUoXCJrc2FuYS1qc29ucm9tXCIpLmh0bWw1ZnMucmVhZGRpcihmdW5jdGlvbihrZGJzKXtcclxuXHRcdFx0Y2IuYXBwbHkodGhpcyxba2Ric10pO1xyXG5cdH0sY29udGV4dHx8dGhpcyk7XHRcdFxyXG5cclxufVxyXG5cclxudmFyIGxpc3RrZGJfbm9kZT1mdW5jdGlvbigpe1xyXG5cdHZhciBmcz1yZXF1aXJlKFwiZnNcIik7XHJcblx0dmFyIHBhdGg9cmVxdWlyZShcInBhdGhcIilcclxuXHR2YXIgcGFyZW50PXBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLFwiLi5cIik7XHJcblx0dmFyIGZpbGVzPWZzLnJlYWRkaXJTeW5jKHBhcmVudCk7XHJcblx0dmFyIG91dHB1dD1bXTtcclxuXHRmaWxlcy5tYXAoZnVuY3Rpb24oZil7XHJcblx0XHR2YXIgc3ViZGlyPXBhcmVudCtwYXRoLnNlcCtmO1xyXG5cdFx0dmFyIHN0YXQ9ZnMuc3RhdFN5bmMoc3ViZGlyICk7XHJcblx0XHRpZiAoc3RhdC5pc0RpcmVjdG9yeSgpKSB7XHJcblx0XHRcdHZhciBzdWJmaWxlcz1mcy5yZWFkZGlyU3luYyhzdWJkaXIpO1xyXG5cdFx0XHRmb3IgKHZhciBpPTA7aTxzdWJmaWxlcy5sZW5ndGg7aSsrKSB7XHJcblx0XHRcdFx0dmFyIGZpbGU9c3ViZmlsZXNbaV07XHJcblx0XHRcdFx0dmFyIGlkeD1maWxlLmluZGV4T2YoXCIua2RiXCIpO1xyXG5cdFx0XHRcdGlmIChpZHg+LTEmJmlkeD09ZmlsZS5sZW5ndGgtNCkge1xyXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goWyBmaWxlLnN1YnN0cigwLGZpbGUubGVuZ3RoLTQpLCBzdWJkaXIrcGF0aC5zZXArZmlsZV0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0pXHJcblx0cmV0dXJuIG91dHB1dDtcclxufVxyXG5cclxudmFyIGxpc3RrZGI9ZnVuY3Rpb24oKSB7XHJcblx0dmFyIHBsYXRmb3JtPXJlcXVpcmUoXCIuL3BsYXRmb3JtXCIpLmdldFBsYXRmb3JtKCk7XHJcblx0dmFyIGZpbGVzPVtdO1xyXG5cdGlmIChwbGF0Zm9ybT09XCJub2RlXCIgfHwgcGxhdGZvcm09PVwibm9kZS13ZWJraXRcIikge1xyXG5cdFx0ZmlsZXM9bGlzdGtkYl9ub2RlKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IFwibm90IGltcGxlbWVudCB5ZXRcIjtcclxuXHR9XHJcblx0cmV0dXJuIGZpbGVzO1xyXG59XHJcbm1vZHVsZS5leHBvcnRzPWxpc3RrZGI7IiwidmFyIGdldFBsYXRmb3JtPWZ1bmN0aW9uKCkge1xyXG5cdGlmICh0eXBlb2Yga3NhbmFnYXA9PVwidW5kZWZpbmVkXCIpIHtcclxuXHRcdHBsYXRmb3JtPVwibm9kZVwiO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRwbGF0Zm9ybT1rc2FuYWdhcC5wbGF0Zm9ybTtcclxuXHR9XHJcblx0cmV0dXJuIHBsYXRmb3JtO1xyXG59XHJcbm1vZHVsZS5leHBvcnRzPXtnZXRQbGF0Zm9ybTpnZXRQbGF0Zm9ybX07IiwiLyogZW11bGF0ZSBmaWxlc3lzdGVtIG9uIGh0bWw1IGJyb3dzZXIgKi9cclxudmFyIHJlYWQ9ZnVuY3Rpb24oaGFuZGxlLGJ1ZmZlcixvZmZzZXQsbGVuZ3RoLHBvc2l0aW9uLGNiKSB7Ly9idWZmZXIgYW5kIG9mZnNldCBpcyBub3QgdXNlZFxyXG5cdHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuXHR4aHIub3BlbignR0VUJywgaGFuZGxlLnVybCAsIHRydWUpO1xyXG5cdHZhciByYW5nZT1bcG9zaXRpb24sbGVuZ3RoK3Bvc2l0aW9uLTFdO1xyXG5cdHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdSYW5nZScsICdieXRlcz0nK3JhbmdlWzBdKyctJytyYW5nZVsxXSk7XHJcblx0eGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XHJcblx0eGhyLnNlbmQoKTtcclxuXHR4aHIub25sb2FkID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHRcdFx0Y2IoMCx0aGF0LnJlc3BvbnNlLmJ5dGVMZW5ndGgsdGhhdC5yZXNwb25zZSk7XHJcblx0XHR9LDApO1xyXG5cdH07IFxyXG59XHJcbnZhciBjbG9zZT1mdW5jdGlvbihoYW5kbGUpIHt9XHJcbnZhciBmc3RhdFN5bmM9ZnVuY3Rpb24oaGFuZGxlKSB7XHJcblx0dGhyb3cgXCJub3QgaW1wbGVtZW50IHlldFwiO1xyXG59XHJcbnZhciBmc3RhdD1mdW5jdGlvbihoYW5kbGUsY2IpIHtcclxuXHR0aHJvdyBcIm5vdCBpbXBsZW1lbnQgeWV0XCI7XHJcbn1cclxudmFyIF9vcGVuPWZ1bmN0aW9uKGZuX3VybCxjYikge1xyXG5cdFx0dmFyIGhhbmRsZT17fTtcclxuXHRcdGlmIChmbl91cmwuaW5kZXhPZihcImZpbGVzeXN0ZW06XCIpPT0wKXtcclxuXHRcdFx0aGFuZGxlLnVybD1mbl91cmw7XHJcblx0XHRcdGhhbmRsZS5mbj1mbl91cmwuc3Vic3RyKCBmbl91cmwubGFzdEluZGV4T2YoXCIvXCIpKzEpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aGFuZGxlLmZuPWZuX3VybDtcclxuXHRcdFx0dmFyIHVybD1BUEkuZmlsZXMuZmlsdGVyKGZ1bmN0aW9uKGYpeyByZXR1cm4gKGZbMF09PWZuX3VybCl9KTtcclxuXHRcdFx0aWYgKHVybC5sZW5ndGgpIGhhbmRsZS51cmw9dXJsWzBdWzFdO1xyXG5cdFx0fVxyXG5cdFx0Y2IoaGFuZGxlKTtcclxufVxyXG52YXIgb3Blbj1mdW5jdGlvbihmbl91cmwsY2IpIHtcclxuXHRcdGlmICghQVBJLmluaXRpYWxpemVkKSB7aW5pdCgxMDI0KjEwMjQsZnVuY3Rpb24oKXtcclxuXHRcdFx0X29wZW4uYXBwbHkodGhpcyxbZm5fdXJsLGNiXSk7XHJcblx0XHR9LHRoaXMpfSBlbHNlIF9vcGVuLmFwcGx5KHRoaXMsW2ZuX3VybCxjYl0pO1xyXG59XHJcbnZhciBsb2FkPWZ1bmN0aW9uKGZpbGVuYW1lLG1vZGUsY2IpIHtcclxuXHRvcGVuKGZpbGVuYW1lLG1vZGUsY2IsdHJ1ZSk7XHJcbn1cclxudmFyIGdldF9oZWFkPWZ1bmN0aW9uKHVybCxmaWVsZCxjYil7XHJcblx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcblx0XHR4aHIub3BlbihcIkhFQURcIiwgdXJsLCB0cnVlKTtcclxuXHRcdHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAodGhpcy5yZWFkeVN0YXRlID09IHRoaXMuRE9ORSkge1xyXG5cdFx0XHRcdFx0Y2IoeGhyLmdldFJlc3BvbnNlSGVhZGVyKGZpZWxkKSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLnN0YXR1cyE9PTIwMCYmdGhpcy5zdGF0dXMhPT0yMDYpIHtcclxuXHRcdFx0XHRcdFx0Y2IoXCJcIik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0fTtcclxuXHRcdHhoci5zZW5kKCk7XHRcclxufVxyXG52YXIgZ2V0X2RhdGU9ZnVuY3Rpb24odXJsLGNiKSB7XHJcblx0XHRnZXRfaGVhZCh1cmwsXCJMYXN0LU1vZGlmaWVkXCIsZnVuY3Rpb24odmFsdWUpe1xyXG5cdFx0XHRjYih2YWx1ZSk7XHJcblx0XHR9KTtcclxufVxyXG52YXIgIGdldERvd25sb2FkU2l6ZT1mdW5jdGlvbih1cmwsIGNiKSB7XHJcblx0XHRnZXRfaGVhZCh1cmwsXCJDb250ZW50LUxlbmd0aFwiLGZ1bmN0aW9uKHZhbHVlKXtcclxuXHRcdFx0Y2IocGFyc2VJbnQodmFsdWUpKTtcclxuXHRcdH0pO1xyXG59O1xyXG52YXIgY2hlY2tVcGRhdGU9ZnVuY3Rpb24odXJsLGZuLGNiKSB7XHJcblx0XHRpZiAoIXVybCkge1xyXG5cdFx0XHRjYihmYWxzZSk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGdldF9kYXRlKHVybCxmdW5jdGlvbihkKXtcclxuXHRcdFx0QVBJLmZzLnJvb3QuZ2V0RmlsZShmbiwge2NyZWF0ZTogZmFsc2UsIGV4Y2x1c2l2ZTogZmFsc2V9LCBmdW5jdGlvbihmaWxlRW50cnkpIHtcclxuXHRcdFx0XHRcdGZpbGVFbnRyeS5nZXRNZXRhZGF0YShmdW5jdGlvbihtZXRhZGF0YSl7XHJcblx0XHRcdFx0XHRcdHZhciBsb2NhbERhdGU9RGF0ZS5wYXJzZShtZXRhZGF0YS5tb2RpZmljYXRpb25UaW1lKTtcclxuXHRcdFx0XHRcdFx0dmFyIHVybERhdGU9RGF0ZS5wYXJzZShkKTtcclxuXHRcdFx0XHRcdFx0Y2IodXJsRGF0ZT5sb2NhbERhdGUpO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHR9LGZ1bmN0aW9uKCl7XHJcblx0XHRcdGNiKGZhbHNlKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG59XHJcbnZhciBkb3dubG9hZD1mdW5jdGlvbih1cmwsZm4sY2Isc3RhdHVzY2IsY29udGV4dCkge1xyXG5cdCB2YXIgdG90YWxzaXplPTAsYmF0Y2hlcz1udWxsLHdyaXR0ZW49MDtcclxuXHQgdmFyIGZpbGVFbnRyeT0wLCBmaWxlV3JpdGVyPTA7XHJcblx0IHZhciBjcmVhdGVCYXRjaGVzPWZ1bmN0aW9uKHNpemUpIHtcclxuXHRcdFx0dmFyIGJ5dGVzPTEwMjQqMTAyNCwgb3V0PVtdO1xyXG5cdFx0XHR2YXIgYj1NYXRoLmZsb29yKHNpemUgLyBieXRlcyk7XHJcblx0XHRcdHZhciBsYXN0PXNpemUgJWJ5dGVzO1xyXG5cdFx0XHRmb3IgKHZhciBpPTA7aTw9YjtpKyspIHtcclxuXHRcdFx0XHRvdXQucHVzaChpKmJ5dGVzKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRvdXQucHVzaChiKmJ5dGVzK2xhc3QpO1xyXG5cdFx0XHRyZXR1cm4gb3V0O1xyXG5cdCB9XHJcblx0IHZhciBmaW5pc2g9ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0IHJtKGZuLGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0XHRcdGZpbGVFbnRyeS5tb3ZlVG8oZmlsZUVudHJ5LmZpbGVzeXN0ZW0ucm9vdCwgZm4sZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCBjYi5iaW5kKGNvbnRleHQsZmFsc2UpICwgMCkgOyBcclxuXHRcdFx0XHRcdFx0fSxmdW5jdGlvbihlKXtcclxuXHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhcImZhaWxlZFwiLGUpXHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdCB9LHRoaXMpOyBcclxuXHQgfVxyXG5cdFx0dmFyIHRlbXBmbj1cInRlbXAua2RiXCI7XHJcblx0XHR2YXIgYmF0Y2g9ZnVuY3Rpb24oYikge1xyXG5cdFx0XHQgdmFyIGFib3J0PWZhbHNlO1xyXG5cdFx0XHQgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG5cdFx0XHQgdmFyIHJlcXVlc3R1cmw9dXJsK1wiP1wiK01hdGgucmFuZG9tKCk7XHJcblx0XHRcdCB4aHIub3BlbignZ2V0JywgcmVxdWVzdHVybCwgdHJ1ZSk7XHJcblx0XHRcdCB4aHIuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JytiYXRjaGVzW2JdKyctJysoYmF0Y2hlc1tiKzFdLTEpKTtcclxuXHRcdFx0IHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYic7ICAgIFxyXG5cdFx0XHQgeGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHQgdmFyIGJsb2I9dGhpcy5yZXNwb25zZTtcclxuXHRcdFx0XHQgZmlsZUVudHJ5LmNyZWF0ZVdyaXRlcihmdW5jdGlvbihmaWxlV3JpdGVyKSB7XHJcblx0XHRcdFx0IGZpbGVXcml0ZXIuc2VlayhmaWxlV3JpdGVyLmxlbmd0aCk7XHJcblx0XHRcdFx0IGZpbGVXcml0ZXIud3JpdGUoYmxvYik7XHJcblx0XHRcdFx0IHdyaXR0ZW4rPWJsb2Iuc2l6ZTtcclxuXHRcdFx0XHQgZmlsZVdyaXRlci5vbndyaXRlZW5kID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdFx0IGlmIChzdGF0dXNjYikge1xyXG5cdFx0XHRcdFx0XHRcdGFib3J0PXN0YXR1c2NiLmFwcGx5KGNvbnRleHQsWyBmaWxlV3JpdGVyLmxlbmd0aCAvIHRvdGFsc2l6ZSx0b3RhbHNpemUgXSk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKGFib3J0KSBzZXRUaW1lb3V0KCBjYi5iaW5kKGNvbnRleHQsZmFsc2UpICwgMCkgO1xyXG5cdFx0XHRcdFx0IH1cclxuXHRcdFx0XHRcdCBiKys7XHJcblx0XHRcdFx0XHQgaWYgKCFhYm9ydCkge1xyXG5cdFx0XHRcdFx0XHRcdGlmIChiPGJhdGNoZXMubGVuZ3RoLTEpIHNldFRpbWVvdXQoYmF0Y2guYmluZChjb250ZXh0LGIpLDApO1xyXG5cdFx0XHRcdFx0XHRcdGVsc2UgICAgICAgICAgICAgICAgICAgIGZpbmlzaCgpO1xyXG5cdFx0XHRcdFx0IH1cclxuXHRcdFx0XHQgfTtcclxuXHRcdFx0XHR9LCBjb25zb2xlLmVycm9yKTtcclxuXHRcdFx0IH0sZmFsc2UpO1xyXG5cdFx0XHQgeGhyLnNlbmQoKTtcclxuXHRcdH1cclxuXHJcblx0XHQgZ2V0RG93bmxvYWRTaXplKHVybCxmdW5jdGlvbihzaXplKXtcclxuXHRcdFx0IHRvdGFsc2l6ZT1zaXplO1xyXG5cdFx0XHQgaWYgKCFzaXplKSB7XHJcblx0XHRcdFx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW2ZhbHNlXSk7XHJcblx0XHRcdCB9IGVsc2Ugey8vcmVhZHkgdG8gZG93bmxvYWRcclxuXHRcdFx0XHRybSh0ZW1wZm4sZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRcdCBiYXRjaGVzPWNyZWF0ZUJhdGNoZXMoc2l6ZSk7XHJcblx0XHRcdFx0XHQgaWYgKHN0YXR1c2NiKSBzdGF0dXNjYi5hcHBseShjb250ZXh0LFsgMCwgdG90YWxzaXplIF0pO1xyXG5cdFx0XHRcdFx0IEFQSS5mcy5yb290LmdldEZpbGUodGVtcGZuLCB7Y3JlYXRlOiAxLCBleGNsdXNpdmU6IGZhbHNlfSwgZnVuY3Rpb24oX2ZpbGVFbnRyeSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0ZmlsZUVudHJ5PV9maWxlRW50cnk7XHJcblx0XHRcdFx0XHRcdFx0YmF0Y2goMCk7XHJcblx0XHRcdFx0XHQgfSk7XHJcblx0XHRcdFx0fSx0aGlzKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcbn1cclxuXHJcbnZhciByZWFkRmlsZT1mdW5jdGlvbihmaWxlbmFtZSxjYixjb250ZXh0KSB7XHJcblx0QVBJLmZzLnJvb3QuZ2V0RmlsZShmaWxlbmFtZSwgZnVuY3Rpb24oZmlsZUVudHJ5KSB7XHJcblx0XHRcdHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG5cdFx0XHRyZWFkZXIub25sb2FkZW5kID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdFx0aWYgKGNiKSBjYi5hcHBseShjYixbdGhpcy5yZXN1bHRdKTtcclxuXHRcdFx0XHR9OyAgICAgICAgICAgIFxyXG5cdFx0fSwgY29uc29sZS5lcnJvcik7XHJcbn1cclxudmFyIHdyaXRlRmlsZT1mdW5jdGlvbihmaWxlbmFtZSxidWYsY2IsY29udGV4dCl7XHJcblx0IEFQSS5mcy5yb290LmdldEZpbGUoZmlsZW5hbWUsIHtjcmVhdGU6IHRydWUsIGV4Y2x1c2l2ZTogdHJ1ZX0sIGZ1bmN0aW9uKGZpbGVFbnRyeSkge1xyXG5cdFx0XHRmaWxlRW50cnkuY3JlYXRlV3JpdGVyKGZ1bmN0aW9uKGZpbGVXcml0ZXIpIHtcclxuXHRcdFx0XHRmaWxlV3JpdGVyLndyaXRlKGJ1Zik7XHJcblx0XHRcdFx0ZmlsZVdyaXRlci5vbndyaXRlZW5kID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdFx0aWYgKGNiKSBjYi5hcHBseShjYixbYnVmLmJ5dGVMZW5ndGhdKTtcclxuXHRcdFx0XHR9OyAgICAgICAgICAgIFxyXG5cdFx0XHR9LCBjb25zb2xlLmVycm9yKTtcclxuXHRcdH0sIGNvbnNvbGUuZXJyb3IpO1xyXG59XHJcblxyXG52YXIgcmVhZGRpcj1mdW5jdGlvbihjYixjb250ZXh0KSB7XHJcblx0IHZhciBkaXJSZWFkZXIgPSBBUEkuZnMucm9vdC5jcmVhdGVSZWFkZXIoKTtcclxuXHQgdmFyIG91dD1bXSx0aGF0PXRoaXM7XHJcblx0XHRkaXJSZWFkZXIucmVhZEVudHJpZXMoZnVuY3Rpb24oZW50cmllcykge1xyXG5cdFx0XHRpZiAoZW50cmllcy5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBlbnRyeTsgZW50cnkgPSBlbnRyaWVzW2ldOyArK2kpIHtcclxuXHRcdFx0XHRcdFx0aWYgKGVudHJ5LmlzRmlsZSkge1xyXG5cdFx0XHRcdFx0XHRcdG91dC5wdXNoKFtlbnRyeS5uYW1lLGVudHJ5LnRvVVJMID8gZW50cnkudG9VUkwoKSA6IGVudHJ5LnRvVVJJKCldKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdEFQSS5maWxlcz1vdXQ7XHJcblx0XHRcdGlmIChjYikgY2IuYXBwbHkoY29udGV4dCxbb3V0XSk7XHJcblx0XHR9LCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW251bGxdKTtcclxuXHRcdH0pO1xyXG59XHJcbnZhciBnZXRGaWxlVVJMPWZ1bmN0aW9uKGZpbGVuYW1lKSB7XHJcblx0aWYgKCFBUEkuZmlsZXMgKSByZXR1cm4gbnVsbDtcclxuXHR2YXIgZmlsZT0gQVBJLmZpbGVzLmZpbHRlcihmdW5jdGlvbihmKXtyZXR1cm4gZlswXT09ZmlsZW5hbWV9KTtcclxuXHRpZiAoZmlsZS5sZW5ndGgpIHJldHVybiBmaWxlWzBdWzFdO1xyXG59XHJcbnZhciBybT1mdW5jdGlvbihmaWxlbmFtZSxjYixjb250ZXh0KSB7XHJcblx0IHZhciB1cmw9Z2V0RmlsZVVSTChmaWxlbmFtZSk7XHJcblx0IGlmICh1cmwpIHJtVVJMKHVybCxjYixjb250ZXh0KTtcclxuXHQgZWxzZSBpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW2ZhbHNlXSk7XHJcbn1cclxuXHJcbnZhciBybVVSTD1mdW5jdGlvbihmaWxlbmFtZSxjYixjb250ZXh0KSB7XHJcblx0XHR3ZWJraXRSZXNvbHZlTG9jYWxGaWxlU3lzdGVtVVJMKGZpbGVuYW1lLCBmdW5jdGlvbihmaWxlRW50cnkpIHtcclxuXHRcdFx0ZmlsZUVudHJ5LnJlbW92ZShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW3RydWVdKTtcclxuXHRcdFx0fSwgY29uc29sZS5lcnJvcik7XHJcblx0XHR9LCAgZnVuY3Rpb24oZSl7XHJcblx0XHRcdGlmIChjYikgY2IuYXBwbHkoY29udGV4dCxbZmFsc2VdKTsvL25vIHN1Y2ggZmlsZVxyXG5cdFx0fSk7XHJcbn1cclxuZnVuY3Rpb24gZXJyb3JIYW5kbGVyKGUpIHtcclxuXHRjb25zb2xlLmVycm9yKCdFcnJvcjogJyArZS5uYW1lKyBcIiBcIitlLm1lc3NhZ2UpO1xyXG59XHJcbnZhciBpbml0ZnM9ZnVuY3Rpb24oZ3JhbnRlZEJ5dGVzLGNiLGNvbnRleHQpIHtcclxuXHR3ZWJraXRSZXF1ZXN0RmlsZVN5c3RlbShQRVJTSVNURU5ULCBncmFudGVkQnl0ZXMsICBmdW5jdGlvbihmcykge1xyXG5cdFx0QVBJLmZzPWZzO1xyXG5cdFx0QVBJLnF1b3RhPWdyYW50ZWRCeXRlcztcclxuXHRcdHJlYWRkaXIoZnVuY3Rpb24oKXtcclxuXHRcdFx0QVBJLmluaXRpYWxpemVkPXRydWU7XHJcblx0XHRcdGNiLmFwcGx5KGNvbnRleHQsW2dyYW50ZWRCeXRlcyxmc10pO1xyXG5cdFx0fSxjb250ZXh0KTtcclxuXHR9LCBlcnJvckhhbmRsZXIpO1xyXG59XHJcbnZhciBpbml0PWZ1bmN0aW9uKHF1b3RhLGNiLGNvbnRleHQpIHtcclxuXHRuYXZpZ2F0b3Iud2Via2l0UGVyc2lzdGVudFN0b3JhZ2UucmVxdWVzdFF1b3RhKHF1b3RhLCBcclxuXHRcdFx0ZnVuY3Rpb24oZ3JhbnRlZEJ5dGVzKSB7XHJcblx0XHRcdFx0aW5pdGZzKGdyYW50ZWRCeXRlcyxjYixjb250ZXh0KTtcclxuXHRcdH0sIGNvbnNvbGUuZXJyb3IgXHJcblx0KTtcclxufVxyXG52YXIgcXVlcnlRdW90YT1mdW5jdGlvbihjYixjb250ZXh0KSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0bmF2aWdhdG9yLndlYmtpdFBlcnNpc3RlbnRTdG9yYWdlLnF1ZXJ5VXNhZ2VBbmRRdW90YSggXHJcblx0XHQgZnVuY3Rpb24odXNhZ2UscXVvdGEpe1xyXG5cdFx0XHRcdGluaXRmcyhxdW90YSxmdW5jdGlvbigpe1xyXG5cdFx0XHRcdFx0Y2IuYXBwbHkoY29udGV4dCxbdXNhZ2UscXVvdGFdKTtcclxuXHRcdFx0XHR9LGNvbnRleHQpO1xyXG5cdFx0fSk7XHJcbn1cclxudmFyIEFQST17XHJcblx0bG9hZDpsb2FkXHJcblx0LG9wZW46b3BlblxyXG5cdCxyZWFkOnJlYWRcclxuXHQsZnN0YXRTeW5jOmZzdGF0U3luY1xyXG5cdCxmc3RhdDpmc3RhdCxjbG9zZTpjbG9zZVxyXG5cdCxpbml0OmluaXRcclxuXHQscmVhZGRpcjpyZWFkZGlyXHJcblx0LGNoZWNrVXBkYXRlOmNoZWNrVXBkYXRlXHJcblx0LHJtOnJtXHJcblx0LHJtVVJMOnJtVVJMXHJcblx0LGdldEZpbGVVUkw6Z2V0RmlsZVVSTFxyXG5cdCxnZXREb3dubG9hZFNpemU6Z2V0RG93bmxvYWRTaXplXHJcblx0LHdyaXRlRmlsZTp3cml0ZUZpbGVcclxuXHQscmVhZEZpbGU6cmVhZEZpbGVcclxuXHQsZG93bmxvYWQ6ZG93bmxvYWRcclxuXHQscXVlcnlRdW90YTpxdWVyeVF1b3RhXHJcbn1cclxuXHRtb2R1bGUuZXhwb3J0cz1BUEk7IiwibW9kdWxlLmV4cG9ydHM9e1xyXG5cdG9wZW46cmVxdWlyZShcIi4va2RiXCIpXHJcblx0LGNyZWF0ZTpyZXF1aXJlKFwiLi9rZGJ3XCIpXHJcblx0LGh0bWw1ZnM6cmVxdWlyZShcIi4vaHRtbDVmc1wiKVxyXG59XHJcbiIsIi8qXHJcblx0S0RCIHZlcnNpb24gMy4wIEdQTFxyXG5cdHlhcGNoZWFoc2hlbkBnbWFpbC5jb21cclxuXHQyMDEzLzEyLzI4XHJcblx0YXN5bmNyb25pemUgdmVyc2lvbiBvZiB5YWRiXHJcblxyXG4gIHJlbW92ZSBkZXBlbmRlbmN5IG9mIFEsIHRoYW5rcyB0b1xyXG4gIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNDIzNDYxOS9ob3ctdG8tYXZvaWQtbG9uZy1uZXN0aW5nLW9mLWFzeW5jaHJvbm91cy1mdW5jdGlvbnMtaW4tbm9kZS1qc1xyXG5cclxuICAyMDE1LzEvMlxyXG4gIG1vdmVkIHRvIGtzYW5hZm9yZ2Uva3NhbmEtanNvbnJvbVxyXG4gIGFkZCBlcnIgaW4gY2FsbGJhY2sgZm9yIG5vZGUuanMgY29tcGxpYW50XHJcbiovXHJcbnZhciBLZnM9bnVsbDtcclxuXHJcbmlmICh0eXBlb2Yga3NhbmFnYXA9PVwidW5kZWZpbmVkXCIpIHtcclxuXHRLZnM9cmVxdWlyZSgnLi9rZGJmcycpO1x0XHRcdFxyXG59IGVsc2Uge1xyXG5cdGlmIChrc2FuYWdhcC5wbGF0Zm9ybT09XCJpb3NcIikge1xyXG5cdFx0S2ZzPXJlcXVpcmUoXCIuL2tkYmZzX2lvc1wiKTtcclxuXHR9IGVsc2UgaWYgKGtzYW5hZ2FwLnBsYXRmb3JtPT1cIm5vZGUtd2Via2l0XCIpIHtcclxuXHRcdEtmcz1yZXF1aXJlKFwiLi9rZGJmc1wiKTtcclxuXHR9IGVsc2UgaWYgKGtzYW5hZ2FwLnBsYXRmb3JtPT1cImNocm9tZVwiKSB7XHJcblx0XHRLZnM9cmVxdWlyZShcIi4va2RiZnNcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdEtmcz1yZXF1aXJlKFwiLi9rZGJmc19hbmRyb2lkXCIpO1xyXG5cdH1cclxuXHRcdFxyXG59XHJcblxyXG5cclxudmFyIERUPXtcclxuXHR1aW50ODonMScsIC8vdW5zaWduZWQgMSBieXRlIGludGVnZXJcclxuXHRpbnQzMjonNCcsIC8vIHNpZ25lZCA0IGJ5dGVzIGludGVnZXJcclxuXHR1dGY4Oic4JywgIFxyXG5cdHVjczI6JzInLFxyXG5cdGJvb2w6J14nLCBcclxuXHRibG9iOicmJyxcclxuXHR1dGY4YXJyOicqJywgLy9zaGlmdCBvZiA4XHJcblx0dWNzMmFycjonQCcsIC8vc2hpZnQgb2YgMlxyXG5cdHVpbnQ4YXJyOichJywgLy9zaGlmdCBvZiAxXHJcblx0aW50MzJhcnI6JyQnLCAvL3NoaWZ0IG9mIDRcclxuXHR2aW50OidgJyxcclxuXHRwaW50Oid+JyxcdFxyXG5cclxuXHRhcnJheTonXFx1MDAxYicsXHJcblx0b2JqZWN0OidcXHUwMDFhJyBcclxuXHQvL3lkYiBzdGFydCB3aXRoIG9iamVjdCBzaWduYXR1cmUsXHJcblx0Ly90eXBlIGEgeWRiIGluIGNvbW1hbmQgcHJvbXB0IHNob3dzIG5vdGhpbmdcclxufVxyXG52YXIgdmVyYm9zZT0wLCByZWFkTG9nPWZ1bmN0aW9uKCl7fTtcclxudmFyIF9yZWFkTG9nPWZ1bmN0aW9uKHJlYWR0eXBlLGJ5dGVzKSB7XHJcblx0Y29uc29sZS5sb2cocmVhZHR5cGUsYnl0ZXMsXCJieXRlc1wiKTtcclxufVxyXG5pZiAodmVyYm9zZSkgcmVhZExvZz1fcmVhZExvZztcclxudmFyIHN0cnNlcD1cIlxcdWZmZmZcIjtcclxudmFyIENyZWF0ZT1mdW5jdGlvbihwYXRoLG9wdHMsY2IpIHtcclxuXHQvKiBsb2FkeHh4IGZ1bmN0aW9ucyBtb3ZlIGZpbGUgcG9pbnRlciAqL1xyXG5cdC8vIGxvYWQgdmFyaWFibGUgbGVuZ3RoIGludFxyXG5cdGlmICh0eXBlb2Ygb3B0cz09XCJmdW5jdGlvblwiKSB7XHJcblx0XHRjYj1vcHRzO1xyXG5cdFx0b3B0cz17fTtcclxuXHR9XHJcblxyXG5cdFxyXG5cdHZhciBsb2FkVkludCA9ZnVuY3Rpb24ob3B0cyxibG9ja3NpemUsY291bnQsY2IpIHtcclxuXHRcdC8vaWYgKGNvdW50PT0wKSByZXR1cm4gW107XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cclxuXHRcdHRoaXMuZnMucmVhZEJ1Zl9wYWNrZWRpbnQob3B0cy5jdXIsYmxvY2tzaXplLGNvdW50LHRydWUsZnVuY3Rpb24obyl7XHJcblx0XHRcdC8vY29uc29sZS5sb2coXCJ2aW50XCIpO1xyXG5cdFx0XHRvcHRzLmN1cis9by5hZHY7XHJcblx0XHRcdGNiLmFwcGx5KHRoYXQsW28uZGF0YV0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdHZhciBsb2FkVkludDE9ZnVuY3Rpb24ob3B0cyxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGxvYWRWSW50LmFwcGx5KHRoaXMsW29wdHMsNiwxLGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0XHQvL2NvbnNvbGUubG9nKFwidmludDFcIik7XHJcblx0XHRcdGNiLmFwcGx5KHRoYXQsW2RhdGFbMF1dKTtcclxuXHRcdH1dKVxyXG5cdH1cclxuXHQvL2ZvciBwb3N0aW5nc1xyXG5cdHZhciBsb2FkUEludCA9ZnVuY3Rpb24ob3B0cyxibG9ja3NpemUsY291bnQsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR0aGlzLmZzLnJlYWRCdWZfcGFja2VkaW50KG9wdHMuY3VyLGJsb2Nrc2l6ZSxjb3VudCxmYWxzZSxmdW5jdGlvbihvKXtcclxuXHRcdFx0Ly9jb25zb2xlLmxvZyhcInBpbnRcIik7XHJcblx0XHRcdG9wdHMuY3VyKz1vLmFkdjtcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbby5kYXRhXSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0Ly8gaXRlbSBjYW4gYmUgYW55IHR5cGUgKHZhcmlhYmxlIGxlbmd0aClcclxuXHQvLyBtYXhpbXVtIHNpemUgb2YgYXJyYXkgaXMgMVRCIDJeNDBcclxuXHQvLyBzdHJ1Y3R1cmU6XHJcblx0Ly8gc2lnbmF0dXJlLDUgYnl0ZXMgb2Zmc2V0LCBwYXlsb2FkLCBpdGVtbGVuZ3Roc1xyXG5cdHZhciBnZXRBcnJheUxlbmd0aD1mdW5jdGlvbihvcHRzLGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0dmFyIGRhdGFvZmZzZXQ9MDtcclxuXHJcblx0XHR0aGlzLmZzLnJlYWRVSTgob3B0cy5jdXIsZnVuY3Rpb24obGVuKXtcclxuXHRcdFx0dmFyIGxlbmd0aG9mZnNldD1sZW4qNDI5NDk2NzI5NjtcclxuXHRcdFx0b3B0cy5jdXIrKztcclxuXHRcdFx0dGhhdC5mcy5yZWFkVUkzMihvcHRzLmN1cixmdW5jdGlvbihsZW4pe1xyXG5cdFx0XHRcdG9wdHMuY3VyKz00O1xyXG5cdFx0XHRcdGRhdGFvZmZzZXQ9b3B0cy5jdXI7IC8va2VlcCB0aGlzXHJcblx0XHRcdFx0bGVuZ3Rob2Zmc2V0Kz1sZW47XHJcblx0XHRcdFx0b3B0cy5jdXIrPWxlbmd0aG9mZnNldDtcclxuXHJcblx0XHRcdFx0bG9hZFZJbnQxLmFwcGx5KHRoYXQsW29wdHMsZnVuY3Rpb24oY291bnQpe1xyXG5cdFx0XHRcdFx0bG9hZFZJbnQuYXBwbHkodGhhdCxbb3B0cyxjb3VudCo2LGNvdW50LGZ1bmN0aW9uKHN6KXtcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0Y2Ioe2NvdW50OmNvdW50LHN6OnN6LG9mZnNldDpkYXRhb2Zmc2V0fSk7XHJcblx0XHRcdFx0XHR9XSk7XHJcblx0XHRcdFx0fV0pO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0dmFyIGxvYWRBcnJheSA9IGZ1bmN0aW9uKG9wdHMsYmxvY2tzaXplLGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0Z2V0QXJyYXlMZW5ndGguYXBwbHkodGhpcyxbb3B0cyxmdW5jdGlvbihMKXtcclxuXHRcdFx0XHR2YXIgbz1bXTtcclxuXHRcdFx0XHR2YXIgZW5kY3VyPW9wdHMuY3VyO1xyXG5cdFx0XHRcdG9wdHMuY3VyPUwub2Zmc2V0O1xyXG5cclxuXHRcdFx0XHRpZiAob3B0cy5sYXp5KSB7IFxyXG5cdFx0XHRcdFx0XHR2YXIgb2Zmc2V0PUwub2Zmc2V0O1xyXG5cdFx0XHRcdFx0XHRMLnN6Lm1hcChmdW5jdGlvbihzeil7XHJcblx0XHRcdFx0XHRcdFx0b1tvLmxlbmd0aF09c3Ryc2VwK29mZnNldC50b1N0cmluZygxNilcclxuXHRcdFx0XHRcdFx0XHRcdCAgICtzdHJzZXArc3oudG9TdHJpbmcoMTYpO1xyXG5cdFx0XHRcdFx0XHRcdG9mZnNldCs9c3o7XHJcblx0XHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHZhciB0YXNrcXVldWU9W107XHJcblx0XHRcdFx0XHRmb3IgKHZhciBpPTA7aTxMLmNvdW50O2krKykge1xyXG5cdFx0XHRcdFx0XHR0YXNrcXVldWUucHVzaChcclxuXHRcdFx0XHRcdFx0XHQoZnVuY3Rpb24oc3ope1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIChcclxuXHRcdFx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24oZGF0YSl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBkYXRhPT0nb2JqZWN0JyAmJiBkYXRhLl9fZW1wdHkpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAvL25vdCBwdXNoaW5nIHRoZSBmaXJzdCBjYWxsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVx0ZWxzZSBvLnB1c2goZGF0YSk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0b3B0cy5ibG9ja3NpemU9c3o7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0bG9hZC5hcHBseSh0aGF0LFtvcHRzLCB0YXNrcXVldWUuc2hpZnQoKV0pO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRcdH0pKEwuc3pbaV0pXHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvL2xhc3QgY2FsbCB0byBjaGlsZCBsb2FkXHJcblx0XHRcdFx0XHR0YXNrcXVldWUucHVzaChmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0XHRcdFx0by5wdXNoKGRhdGEpO1xyXG5cdFx0XHRcdFx0XHRvcHRzLmN1cj1lbmRjdXI7XHJcblx0XHRcdFx0XHRcdGNiLmFwcGx5KHRoYXQsW29dKTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKG9wdHMubGF6eSkgY2IuYXBwbHkodGhhdCxbb10pO1xyXG5cdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0dGFza3F1ZXVlLnNoaWZ0KCkoe19fZW1wdHk6dHJ1ZX0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XSlcclxuXHR9XHRcdFxyXG5cdC8vIGl0ZW0gY2FuIGJlIGFueSB0eXBlICh2YXJpYWJsZSBsZW5ndGgpXHJcblx0Ly8gc3VwcG9ydCBsYXp5IGxvYWRcclxuXHQvLyBzdHJ1Y3R1cmU6XHJcblx0Ly8gc2lnbmF0dXJlLDUgYnl0ZXMgb2Zmc2V0LCBwYXlsb2FkLCBpdGVtbGVuZ3RocywgXHJcblx0Ly8gICAgICAgICAgICAgICAgICAgIHN0cmluZ2FycmF5X3NpZ25hdHVyZSwga2V5c1xyXG5cdHZhciBsb2FkT2JqZWN0ID0gZnVuY3Rpb24ob3B0cyxibG9ja3NpemUsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR2YXIgc3RhcnQ9b3B0cy5jdXI7XHJcblx0XHRnZXRBcnJheUxlbmd0aC5hcHBseSh0aGlzLFtvcHRzLGZ1bmN0aW9uKEwpIHtcclxuXHRcdFx0b3B0cy5ibG9ja3NpemU9YmxvY2tzaXplLW9wdHMuY3VyK3N0YXJ0O1xyXG5cdFx0XHRsb2FkLmFwcGx5KHRoYXQsW29wdHMsZnVuY3Rpb24oa2V5cyl7IC8vbG9hZCB0aGUga2V5c1xyXG5cdFx0XHRcdGlmIChvcHRzLmtleXMpIHsgLy9jYWxsZXIgYXNrIGZvciBrZXlzXHJcblx0XHRcdFx0XHRrZXlzLm1hcChmdW5jdGlvbihrKSB7IG9wdHMua2V5cy5wdXNoKGspfSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgbz17fTtcclxuXHRcdFx0XHR2YXIgZW5kY3VyPW9wdHMuY3VyO1xyXG5cdFx0XHRcdG9wdHMuY3VyPUwub2Zmc2V0O1xyXG5cdFx0XHRcdGlmIChvcHRzLmxhenkpIHsgXHJcblx0XHRcdFx0XHR2YXIgb2Zmc2V0PUwub2Zmc2V0O1xyXG5cdFx0XHRcdFx0Zm9yICh2YXIgaT0wO2k8TC5zei5sZW5ndGg7aSsrKSB7XHJcblx0XHRcdFx0XHRcdC8vcHJlZml4IHdpdGggYSBcXDAsIGltcG9zc2libGUgZm9yIG5vcm1hbCBzdHJpbmdcclxuXHRcdFx0XHRcdFx0b1trZXlzW2ldXT1zdHJzZXArb2Zmc2V0LnRvU3RyaW5nKDE2KVxyXG5cdFx0XHRcdFx0XHRcdCAgICtzdHJzZXArTC5zeltpXS50b1N0cmluZygxNik7XHJcblx0XHRcdFx0XHRcdG9mZnNldCs9TC5zeltpXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dmFyIHRhc2txdWV1ZT1bXTtcclxuXHRcdFx0XHRcdGZvciAodmFyIGk9MDtpPEwuY291bnQ7aSsrKSB7XHJcblx0XHRcdFx0XHRcdHRhc2txdWV1ZS5wdXNoKFxyXG5cdFx0XHRcdFx0XHRcdChmdW5jdGlvbihzeixrZXkpe1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIChcclxuXHRcdFx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24oZGF0YSl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBkYXRhPT0nb2JqZWN0JyAmJiBkYXRhLl9fZW1wdHkpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vbm90IHNhdmluZyB0aGUgZmlyc3QgY2FsbDtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0b1trZXldPWRhdGE7IFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRvcHRzLmJsb2Nrc2l6ZT1zejtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAodmVyYm9zZSkgcmVhZExvZyhcImtleVwiLGtleSk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0bG9hZC5hcHBseSh0aGF0LFtvcHRzLCB0YXNrcXVldWUuc2hpZnQoKV0pO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRcdH0pKEwuc3pbaV0sa2V5c1tpLTFdKVxyXG5cclxuXHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdC8vbGFzdCBjYWxsIHRvIGNoaWxkIGxvYWRcclxuXHRcdFx0XHRcdHRhc2txdWV1ZS5wdXNoKGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0XHRcdFx0XHRvW2tleXNba2V5cy5sZW5ndGgtMV1dPWRhdGE7XHJcblx0XHRcdFx0XHRcdG9wdHMuY3VyPWVuZGN1cjtcclxuXHRcdFx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbb10pO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmIChvcHRzLmxhenkpIGNiLmFwcGx5KHRoYXQsW29dKTtcclxuXHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdHRhc2txdWV1ZS5zaGlmdCgpKHtfX2VtcHR5OnRydWV9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1dKTtcclxuXHRcdH1dKTtcclxuXHR9XHJcblxyXG5cdC8vaXRlbSBpcyBzYW1lIGtub3duIHR5cGVcclxuXHR2YXIgbG9hZFN0cmluZ0FycmF5PWZ1bmN0aW9uKG9wdHMsYmxvY2tzaXplLGVuY29kaW5nLGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0dGhpcy5mcy5yZWFkU3RyaW5nQXJyYXkob3B0cy5jdXIsYmxvY2tzaXplLGVuY29kaW5nLGZ1bmN0aW9uKG8pe1xyXG5cdFx0XHRvcHRzLmN1cis9YmxvY2tzaXplO1xyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtvXSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0dmFyIGxvYWRJbnRlZ2VyQXJyYXk9ZnVuY3Rpb24ob3B0cyxibG9ja3NpemUsdW5pdHNpemUsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRsb2FkVkludDEuYXBwbHkodGhpcyxbb3B0cyxmdW5jdGlvbihjb3VudCl7XHJcblx0XHRcdHZhciBvPXRoYXQuZnMucmVhZEZpeGVkQXJyYXkob3B0cy5jdXIsY291bnQsdW5pdHNpemUsZnVuY3Rpb24obyl7XHJcblx0XHRcdFx0b3B0cy5jdXIrPWNvdW50KnVuaXRzaXplO1xyXG5cdFx0XHRcdGNiLmFwcGx5KHRoYXQsW29dKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9XSk7XHJcblx0fVxyXG5cdHZhciBsb2FkQmxvYj1mdW5jdGlvbihibG9ja3NpemUsY2IpIHtcclxuXHRcdHZhciBvPXRoaXMuZnMucmVhZEJ1Zih0aGlzLmN1cixibG9ja3NpemUpO1xyXG5cdFx0dGhpcy5jdXIrPWJsb2Nrc2l6ZTtcclxuXHRcdHJldHVybiBvO1xyXG5cdH1cdFxyXG5cdHZhciBsb2FkYnlzaWduYXR1cmU9ZnVuY3Rpb24ob3B0cyxzaWduYXR1cmUsY2IpIHtcclxuXHRcdCAgdmFyIGJsb2Nrc2l6ZT1vcHRzLmJsb2Nrc2l6ZXx8dGhpcy5mcy5zaXplOyBcclxuXHRcdFx0b3B0cy5jdXIrPXRoaXMuZnMuc2lnbmF0dXJlX3NpemU7XHJcblx0XHRcdHZhciBkYXRhc2l6ZT1ibG9ja3NpemUtdGhpcy5mcy5zaWduYXR1cmVfc2l6ZTtcclxuXHRcdFx0Ly9iYXNpYyB0eXBlc1xyXG5cdFx0XHRpZiAoc2lnbmF0dXJlPT09RFQuaW50MzIpIHtcclxuXHRcdFx0XHRvcHRzLmN1cis9NDtcclxuXHRcdFx0XHR0aGlzLmZzLnJlYWRJMzIob3B0cy5jdXItNCxjYik7XHJcblx0XHRcdH0gZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQudWludDgpIHtcclxuXHRcdFx0XHRvcHRzLmN1cisrO1xyXG5cdFx0XHRcdHRoaXMuZnMucmVhZFVJOChvcHRzLmN1ci0xLGNiKTtcclxuXHRcdFx0fSBlbHNlIGlmIChzaWduYXR1cmU9PT1EVC51dGY4KSB7XHJcblx0XHRcdFx0dmFyIGM9b3B0cy5jdXI7b3B0cy5jdXIrPWRhdGFzaXplO1xyXG5cdFx0XHRcdHRoaXMuZnMucmVhZFN0cmluZyhjLGRhdGFzaXplLCd1dGY4JyxjYik7XHJcblx0XHRcdH0gZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQudWNzMikge1xyXG5cdFx0XHRcdHZhciBjPW9wdHMuY3VyO29wdHMuY3VyKz1kYXRhc2l6ZTtcclxuXHRcdFx0XHR0aGlzLmZzLnJlYWRTdHJpbmcoYyxkYXRhc2l6ZSwndWNzMicsY2IpO1x0XHJcblx0XHRcdH0gZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQuYm9vbCkge1xyXG5cdFx0XHRcdG9wdHMuY3VyKys7XHJcblx0XHRcdFx0dGhpcy5mcy5yZWFkVUk4KG9wdHMuY3VyLTEsZnVuY3Rpb24oZGF0YSl7Y2IoISFkYXRhKX0pO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHNpZ25hdHVyZT09PURULmJsb2IpIHtcclxuXHRcdFx0XHRsb2FkQmxvYihkYXRhc2l6ZSxjYik7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly92YXJpYWJsZSBsZW5ndGggaW50ZWdlcnNcclxuXHRcdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQudmludCkge1xyXG5cdFx0XHRcdGxvYWRWSW50LmFwcGx5KHRoaXMsW29wdHMsZGF0YXNpemUsZGF0YXNpemUsY2JdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC5waW50KSB7XHJcblx0XHRcdFx0bG9hZFBJbnQuYXBwbHkodGhpcyxbb3B0cyxkYXRhc2l6ZSxkYXRhc2l6ZSxjYl0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vc2ltcGxlIGFycmF5XHJcblx0XHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnV0ZjhhcnIpIHtcclxuXHRcdFx0XHRsb2FkU3RyaW5nQXJyYXkuYXBwbHkodGhpcyxbb3B0cyxkYXRhc2l6ZSwndXRmOCcsY2JdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC51Y3MyYXJyKSB7XHJcblx0XHRcdFx0bG9hZFN0cmluZ0FycmF5LmFwcGx5KHRoaXMsW29wdHMsZGF0YXNpemUsJ3VjczInLGNiXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQudWludDhhcnIpIHtcclxuXHRcdFx0XHRsb2FkSW50ZWdlckFycmF5LmFwcGx5KHRoaXMsW29wdHMsZGF0YXNpemUsMSxjYl0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULmludDMyYXJyKSB7XHJcblx0XHRcdFx0bG9hZEludGVnZXJBcnJheS5hcHBseSh0aGlzLFtvcHRzLGRhdGFzaXplLDQsY2JdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvL25lc3RlZCBzdHJ1Y3R1cmVcclxuXHRcdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQuYXJyYXkpIHtcclxuXHRcdFx0XHRsb2FkQXJyYXkuYXBwbHkodGhpcyxbb3B0cyxkYXRhc2l6ZSxjYl0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULm9iamVjdCkge1xyXG5cdFx0XHRcdGxvYWRPYmplY3QuYXBwbHkodGhpcyxbb3B0cyxkYXRhc2l6ZSxjYl0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ3Vuc3VwcG9ydGVkIHR5cGUnLHNpZ25hdHVyZSxvcHRzKVxyXG5cdFx0XHRcdGNiLmFwcGx5KHRoaXMsW251bGxdKTsvL21ha2Ugc3VyZSBpdCByZXR1cm5cclxuXHRcdFx0XHQvL3Rocm93ICd1bnN1cHBvcnRlZCB0eXBlICcrc2lnbmF0dXJlO1xyXG5cdFx0XHR9XHJcblx0fVxyXG5cclxuXHR2YXIgbG9hZD1mdW5jdGlvbihvcHRzLGNiKSB7XHJcblx0XHRvcHRzPW9wdHN8fHt9OyAvLyB0aGlzIHdpbGwgc2VydmVkIGFzIGNvbnRleHQgZm9yIGVudGlyZSBsb2FkIHByb2NlZHVyZVxyXG5cdFx0b3B0cy5jdXI9b3B0cy5jdXJ8fDA7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0dGhpcy5mcy5yZWFkU2lnbmF0dXJlKG9wdHMuY3VyLCBmdW5jdGlvbihzaWduYXR1cmUpe1xyXG5cdFx0XHRsb2FkYnlzaWduYXR1cmUuYXBwbHkodGhhdCxbb3B0cyxzaWduYXR1cmUsY2JdKVxyXG5cdFx0fSk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblx0dmFyIENBQ0hFPW51bGw7XHJcblx0dmFyIEtFWT17fTtcclxuXHR2YXIgQUREUkVTUz17fTtcclxuXHR2YXIgcmVzZXQ9ZnVuY3Rpb24oY2IpIHtcclxuXHRcdGlmICghQ0FDSEUpIHtcclxuXHRcdFx0bG9hZC5hcHBseSh0aGlzLFt7Y3VyOjAsbGF6eTp0cnVlfSxmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0XHRDQUNIRT1kYXRhO1xyXG5cdFx0XHRcdGNiLmNhbGwodGhpcyk7XHJcblx0XHRcdH1dKTtcdFxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Y2IuY2FsbCh0aGlzKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciBleGlzdHM9ZnVuY3Rpb24ocGF0aCxjYikge1xyXG5cdFx0aWYgKHBhdGgubGVuZ3RoPT0wKSByZXR1cm4gdHJ1ZTtcclxuXHRcdHZhciBrZXk9cGF0aC5wb3AoKTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRnZXQuYXBwbHkodGhpcyxbcGF0aCxmYWxzZSxmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0aWYgKCFwYXRoLmpvaW4oc3Ryc2VwKSkgcmV0dXJuICghIUtFWVtrZXldKTtcclxuXHRcdFx0dmFyIGtleXM9S0VZW3BhdGguam9pbihzdHJzZXApXTtcclxuXHRcdFx0cGF0aC5wdXNoKGtleSk7Ly9wdXQgaXQgYmFja1xyXG5cdFx0XHRpZiAoa2V5cykgY2IuYXBwbHkodGhhdCxba2V5cy5pbmRleE9mKGtleSk+LTFdKTtcclxuXHRcdFx0ZWxzZSBjYi5hcHBseSh0aGF0LFtmYWxzZV0pO1xyXG5cdFx0fV0pO1xyXG5cdH1cclxuXHJcblx0dmFyIGdldFN5bmM9ZnVuY3Rpb24ocGF0aCkge1xyXG5cdFx0aWYgKCFDQUNIRSkgcmV0dXJuIHVuZGVmaW5lZDtcdFxyXG5cdFx0dmFyIG89Q0FDSEU7XHJcblx0XHRmb3IgKHZhciBpPTA7aTxwYXRoLmxlbmd0aDtpKyspIHtcclxuXHRcdFx0dmFyIHI9b1twYXRoW2ldXTtcclxuXHRcdFx0aWYgKHR5cGVvZiByPT1cInVuZGVmaW5lZFwiKSByZXR1cm4gbnVsbDtcclxuXHRcdFx0bz1yO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG87XHJcblx0fVxyXG5cdHZhciBnZXQ9ZnVuY3Rpb24ocGF0aCxvcHRzLGNiKSB7XHJcblx0XHRpZiAodHlwZW9mIHBhdGg9PSd1bmRlZmluZWQnKSBwYXRoPVtdO1xyXG5cdFx0aWYgKHR5cGVvZiBwYXRoPT1cInN0cmluZ1wiKSBwYXRoPVtwYXRoXTtcclxuXHRcdC8vb3B0cy5yZWN1cnNpdmU9ISFvcHRzLnJlY3Vyc2l2ZTtcclxuXHRcdGlmICh0eXBlb2Ygb3B0cz09XCJmdW5jdGlvblwiKSB7XHJcblx0XHRcdGNiPW9wdHM7bm9kZVxyXG5cdFx0XHRvcHRzPXt9O1xyXG5cdFx0fVxyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGlmICh0eXBlb2YgY2IhPSdmdW5jdGlvbicpIHJldHVybiBnZXRTeW5jKHBhdGgpO1xyXG5cclxuXHRcdHJlc2V0LmFwcGx5KHRoaXMsW2Z1bmN0aW9uKCl7XHJcblx0XHRcdHZhciBvPUNBQ0hFO1xyXG5cdFx0XHRpZiAocGF0aC5sZW5ndGg9PTApIHtcclxuXHRcdFx0XHRpZiAob3B0cy5hZGRyZXNzKSB7XHJcblx0XHRcdFx0XHRjYihbMCx0aGF0LmZzLnNpemVdKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y2IoT2JqZWN0LmtleXMoQ0FDSEUpKTtcdFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH0gXHJcblx0XHRcdFxyXG5cdFx0XHR2YXIgcGF0aG5vdz1cIlwiLHRhc2txdWV1ZT1bXSxuZXdvcHRzPXt9LHI9bnVsbDtcclxuXHRcdFx0dmFyIGxhc3RrZXk9XCJcIjtcclxuXHJcblx0XHRcdGZvciAodmFyIGk9MDtpPHBhdGgubGVuZ3RoO2krKykge1xyXG5cdFx0XHRcdHZhciB0YXNrPShmdW5jdGlvbihrZXksayl7XHJcblxyXG5cdFx0XHRcdFx0cmV0dXJuIChmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0XHRcdFx0aWYgKCEodHlwZW9mIGRhdGE9PSdvYmplY3QnICYmIGRhdGEuX19lbXB0eSkpIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAodHlwZW9mIG9bbGFzdGtleV09PSdzdHJpbmcnICYmIG9bbGFzdGtleV1bMF09PXN0cnNlcCkgb1tsYXN0a2V5XT17fTtcclxuXHRcdFx0XHRcdFx0XHRvW2xhc3RrZXldPWRhdGE7IFxyXG5cdFx0XHRcdFx0XHRcdG89b1tsYXN0a2V5XTtcclxuXHRcdFx0XHRcdFx0XHRyPWRhdGFba2V5XTtcclxuXHRcdFx0XHRcdFx0XHRLRVlbcGF0aG5vd109b3B0cy5rZXlzO1x0XHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRkYXRhPW9ba2V5XTtcclxuXHRcdFx0XHRcdFx0XHRyPWRhdGE7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmICh0eXBlb2Ygcj09PVwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0XHRcdFx0XHR0YXNrcXVldWU9bnVsbDtcclxuXHRcdFx0XHRcdFx0XHRjYi5hcHBseSh0aGF0LFtyXSk7IC8vcmV0dXJuIGVtcHR5IHZhbHVlXHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRpZiAocGFyc2VJbnQoaykpIHBhdGhub3crPXN0cnNlcDtcclxuXHRcdFx0XHRcdFx0XHRwYXRobm93Kz1rZXk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiByPT0nc3RyaW5nJyAmJiByWzBdPT1zdHJzZXApIHsgLy9vZmZzZXQgb2YgZGF0YSB0byBiZSBsb2FkZWRcclxuXHRcdFx0XHRcdFx0XHRcdHZhciBwPXIuc3Vic3RyaW5nKDEpLnNwbGl0KHN0cnNlcCkubWFwKGZ1bmN0aW9uKGl0ZW0pe3JldHVybiBwYXJzZUludChpdGVtLDE2KX0pO1xyXG5cdFx0XHRcdFx0XHRcdFx0dmFyIGN1cj1wWzBdLHN6PXBbMV07XHJcblx0XHRcdFx0XHRcdFx0XHRuZXdvcHRzLmxhenk9IW9wdHMucmVjdXJzaXZlIHx8IChrPHBhdGgubGVuZ3RoLTEpIDtcclxuXHRcdFx0XHRcdFx0XHRcdG5ld29wdHMuYmxvY2tzaXplPXN6O25ld29wdHMuY3VyPWN1cixuZXdvcHRzLmtleXM9W107XHJcblx0XHRcdFx0XHRcdFx0XHRsYXN0a2V5PWtleTsgLy9sb2FkIGlzIHN5bmMgaW4gYW5kcm9pZFxyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKG9wdHMuYWRkcmVzcyAmJiB0YXNrcXVldWUubGVuZ3RoPT0xKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdEFERFJFU1NbcGF0aG5vd109W2N1cixzel07XHJcblx0XHRcdFx0XHRcdFx0XHRcdHRhc2txdWV1ZS5zaGlmdCgpKG51bGwsQUREUkVTU1twYXRobm93XSk7XHJcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRsb2FkLmFwcGx5KHRoYXQsW25ld29wdHMsIHRhc2txdWV1ZS5zaGlmdCgpXSk7XHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdGlmIChvcHRzLmFkZHJlc3MgJiYgdGFza3F1ZXVlLmxlbmd0aD09MSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR0YXNrcXVldWUuc2hpZnQoKShudWxsLEFERFJFU1NbcGF0aG5vd10pO1xyXG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0dGFza3F1ZXVlLnNoaWZ0KCkuYXBwbHkodGhhdCxbcl0pO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0XHR9KVxyXG5cdFx0XHRcdChwYXRoW2ldLGkpO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdHRhc2txdWV1ZS5wdXNoKHRhc2spO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodGFza3F1ZXVlLmxlbmd0aD09MCkge1xyXG5cdFx0XHRcdGNiLmFwcGx5KHRoYXQsW29dKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvL2xhc3QgY2FsbCB0byBjaGlsZCBsb2FkXHJcblx0XHRcdFx0dGFza3F1ZXVlLnB1c2goZnVuY3Rpb24oZGF0YSxjdXJzeil7XHJcblx0XHRcdFx0XHRpZiAob3B0cy5hZGRyZXNzKSB7XHJcblx0XHRcdFx0XHRcdGNiLmFwcGx5KHRoYXQsW2N1cnN6XSk7XHJcblx0XHRcdFx0XHR9IGVsc2V7XHJcblx0XHRcdFx0XHRcdHZhciBrZXk9cGF0aFtwYXRoLmxlbmd0aC0xXTtcclxuXHRcdFx0XHRcdFx0b1trZXldPWRhdGE7IEtFWVtwYXRobm93XT1vcHRzLmtleXM7XHJcblx0XHRcdFx0XHRcdGNiLmFwcGx5KHRoYXQsW2RhdGFdKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0XHR0YXNrcXVldWUuc2hpZnQoKSh7X19lbXB0eTp0cnVlfSk7XHRcdFx0XHJcblx0XHRcdH1cclxuXHJcblx0XHR9XSk7IC8vcmVzZXRcclxuXHR9XHJcblx0Ly8gZ2V0IGFsbCBrZXlzIGluIGdpdmVuIHBhdGhcclxuXHR2YXIgZ2V0a2V5cz1mdW5jdGlvbihwYXRoLGNiKSB7XHJcblx0XHRpZiAoIXBhdGgpIHBhdGg9W11cclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRnZXQuYXBwbHkodGhpcyxbcGF0aCxmYWxzZSxmdW5jdGlvbigpe1xyXG5cdFx0XHRpZiAocGF0aCAmJiBwYXRoLmxlbmd0aCkge1xyXG5cdFx0XHRcdGNiLmFwcGx5KHRoYXQsW0tFWVtwYXRoLmpvaW4oc3Ryc2VwKV1dKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjYi5hcHBseSh0aGF0LFtPYmplY3Qua2V5cyhDQUNIRSldKTsgXHJcblx0XHRcdFx0Ly90b3AgbGV2ZWwsIG5vcm1hbGx5IGl0IGlzIHZlcnkgc21hbGxcclxuXHRcdFx0fVxyXG5cdFx0fV0pO1xyXG5cdH1cclxuXHJcblx0dmFyIHNldHVwYXBpPWZ1bmN0aW9uKCkge1xyXG5cdFx0dGhpcy5sb2FkPWxvYWQ7XHJcbi8vXHRcdHRoaXMuY3VyPTA7XHJcblx0XHR0aGlzLmNhY2hlPWZ1bmN0aW9uKCkge3JldHVybiBDQUNIRX07XHJcblx0XHR0aGlzLmtleT1mdW5jdGlvbigpIHtyZXR1cm4gS0VZfTtcclxuXHRcdHRoaXMuZnJlZT1mdW5jdGlvbigpIHtcclxuXHRcdFx0Q0FDSEU9bnVsbDtcclxuXHRcdFx0S0VZPW51bGw7XHJcblx0XHRcdHRoaXMuZnMuZnJlZSgpO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5zZXRDYWNoZT1mdW5jdGlvbihjKSB7Q0FDSEU9Y307XHJcblx0XHR0aGlzLmtleXM9Z2V0a2V5cztcclxuXHRcdHRoaXMuZ2V0PWdldDsgICAvLyBnZXQgYSBmaWVsZCwgbG9hZCBpZiBuZWVkZWRcclxuXHRcdHRoaXMuZXhpc3RzPWV4aXN0cztcclxuXHRcdHRoaXMuRFQ9RFQ7XHJcblx0XHRcclxuXHRcdC8vaW5zdGFsbCB0aGUgc3luYyB2ZXJzaW9uIGZvciBub2RlXHJcblx0XHQvL2lmICh0eXBlb2YgcHJvY2VzcyE9XCJ1bmRlZmluZWRcIikgcmVxdWlyZShcIi4va2RiX3N5bmNcIikodGhpcyk7XHJcblx0XHQvL2lmIChjYikgc2V0VGltZW91dChjYi5iaW5kKHRoaXMpLDApO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHZhciBlcnI9MDtcclxuXHRcdGlmIChjYikge1xyXG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0Y2IoZXJyLHRoYXQpO1x0XHJcblx0XHRcdH0sMCk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHZhciB0aGF0PXRoaXM7XHJcblx0dmFyIGtmcz1uZXcgS2ZzKHBhdGgsb3B0cyxmdW5jdGlvbihlcnIpe1xyXG5cdFx0aWYgKGVycikge1xyXG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0Y2IoZXJyLDApO1xyXG5cdFx0XHR9LDApO1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoYXQuc2l6ZT10aGlzLnNpemU7XHJcblx0XHRcdHNldHVwYXBpLmNhbGwodGhhdCk7XHRcdFx0XHJcblx0XHR9XHJcblx0fSk7XHJcblx0dGhpcy5mcz1rZnM7XHJcblx0cmV0dXJuIHRoaXM7XHJcbn1cclxuXHJcbkNyZWF0ZS5kYXRhdHlwZXM9RFQ7XHJcblxyXG5pZiAobW9kdWxlKSBtb2R1bGUuZXhwb3J0cz1DcmVhdGU7XHJcbi8vcmV0dXJuIENyZWF0ZTtcclxuIiwiLyogbm9kZS5qcyBhbmQgaHRtbDUgZmlsZSBzeXN0ZW0gYWJzdHJhY3Rpb24gbGF5ZXIqL1xyXG50cnkge1xyXG5cdHZhciBmcz1yZXF1aXJlKFwiZnNcIik7XHJcblx0dmFyIEJ1ZmZlcj1yZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcjtcclxufSBjYXRjaCAoZSkge1xyXG5cdHZhciBmcz1yZXF1aXJlKCcuL2h0bWw1ZnMnKTtcclxuXHR2YXIgQnVmZmVyPWZ1bmN0aW9uKCl7IHJldHVybiBcIlwifTtcclxuXHR2YXIgaHRtbDVmcz10cnVlOyBcdFxyXG59XHJcbnZhciBzaWduYXR1cmVfc2l6ZT0xO1xyXG52YXIgdmVyYm9zZT0wLCByZWFkTG9nPWZ1bmN0aW9uKCl7fTtcclxudmFyIF9yZWFkTG9nPWZ1bmN0aW9uKHJlYWR0eXBlLGJ5dGVzKSB7XHJcblx0Y29uc29sZS5sb2cocmVhZHR5cGUsYnl0ZXMsXCJieXRlc1wiKTtcclxufVxyXG5pZiAodmVyYm9zZSkgcmVhZExvZz1fcmVhZExvZztcclxuXHJcbnZhciB1bnBhY2tfaW50ID0gZnVuY3Rpb24gKGFyLCBjb3VudCAsIHJlc2V0KSB7XHJcbiAgIGNvdW50PWNvdW50fHxhci5sZW5ndGg7XHJcbiAgdmFyIHIgPSBbXSwgaSA9IDAsIHYgPSAwO1xyXG4gIGRvIHtcclxuXHR2YXIgc2hpZnQgPSAwO1xyXG5cdGRvIHtcclxuXHQgIHYgKz0gKChhcltpXSAmIDB4N0YpIDw8IHNoaWZ0KTtcclxuXHQgIHNoaWZ0ICs9IDc7XHQgIFxyXG5cdH0gd2hpbGUgKGFyWysraV0gJiAweDgwKTtcclxuXHRyLnB1c2godik7IGlmIChyZXNldCkgdj0wO1xyXG5cdGNvdW50LS07XHJcbiAgfSB3aGlsZSAoaTxhci5sZW5ndGggJiYgY291bnQpO1xyXG4gIHJldHVybiB7ZGF0YTpyLCBhZHY6aSB9O1xyXG59XHJcbnZhciBPcGVuPWZ1bmN0aW9uKHBhdGgsb3B0cyxjYikge1xyXG5cdG9wdHM9b3B0c3x8e307XHJcblxyXG5cdHZhciByZWFkU2lnbmF0dXJlPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdFx0dmFyIGJ1Zj1uZXcgQnVmZmVyKHNpZ25hdHVyZV9zaXplKTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZiwwLHNpZ25hdHVyZV9zaXplLHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdGlmIChodG1sNWZzKSB2YXIgc2lnbmF0dXJlPVN0cmluZy5mcm9tQ2hhckNvZGUoKG5ldyBVaW50OEFycmF5KGJ1ZmZlcikpWzBdKVxyXG5cdFx0XHRlbHNlIHZhciBzaWduYXR1cmU9YnVmZmVyLnRvU3RyaW5nKCd1dGY4JywwLHNpZ25hdHVyZV9zaXplKTtcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbc2lnbmF0dXJlXSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vdGhpcyBpcyBxdWl0ZSBzbG93XHJcblx0Ly93YWl0IGZvciBTdHJpbmdWaWV3ICtBcnJheUJ1ZmZlciB0byBzb2x2ZSB0aGUgcHJvYmxlbVxyXG5cdC8vaHR0cHM6Ly9ncm91cHMuZ29vZ2xlLmNvbS9hL2Nocm9taXVtLm9yZy9mb3J1bS8jIXRvcGljL2JsaW5rLWRldi95bGdpTllfWlNWMFxyXG5cdC8vaWYgdGhlIHN0cmluZyBpcyBhbHdheXMgdWNzMlxyXG5cdC8vY2FuIHVzZSBVaW50MTYgdG8gcmVhZCBpdC5cclxuXHQvL2h0dHA6Ly91cGRhdGVzLmh0bWw1cm9ja3MuY29tLzIwMTIvMDYvSG93LXRvLWNvbnZlcnQtQXJyYXlCdWZmZXItdG8tYW5kLWZyb20tU3RyaW5nXHJcblx0dmFyIGRlY29kZXV0ZjggPSBmdW5jdGlvbiAodXRmdGV4dCkge1xyXG5cdFx0dmFyIHN0cmluZyA9IFwiXCI7XHJcblx0XHR2YXIgaSA9IDA7XHJcblx0XHR2YXIgYz0wLGMxID0gMCwgYzIgPSAwICwgYzM9MDtcclxuXHRcdGZvciAodmFyIGk9MDtpPHV0ZnRleHQubGVuZ3RoO2krKykge1xyXG5cdFx0XHRpZiAodXRmdGV4dC5jaGFyQ29kZUF0KGkpPjEyNykgYnJlYWs7XHJcblx0XHR9XHJcblx0XHRpZiAoaT49dXRmdGV4dC5sZW5ndGgpIHJldHVybiB1dGZ0ZXh0O1xyXG5cclxuXHRcdHdoaWxlICggaSA8IHV0ZnRleHQubGVuZ3RoICkge1xyXG5cdFx0XHRjID0gdXRmdGV4dC5jaGFyQ29kZUF0KGkpO1xyXG5cdFx0XHRpZiAoYyA8IDEyOCkge1xyXG5cdFx0XHRcdHN0cmluZyArPSB1dGZ0ZXh0W2ldO1xyXG5cdFx0XHRcdGkrKztcclxuXHRcdFx0fSBlbHNlIGlmKChjID4gMTkxKSAmJiAoYyA8IDIyNCkpIHtcclxuXHRcdFx0XHRjMiA9IHV0ZnRleHQuY2hhckNvZGVBdChpKzEpO1xyXG5cdFx0XHRcdHN0cmluZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKCgoYyAmIDMxKSA8PCA2KSB8IChjMiAmIDYzKSk7XHJcblx0XHRcdFx0aSArPSAyO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGMyID0gdXRmdGV4dC5jaGFyQ29kZUF0KGkrMSk7XHJcblx0XHRcdFx0YzMgPSB1dGZ0ZXh0LmNoYXJDb2RlQXQoaSsyKTtcclxuXHRcdFx0XHRzdHJpbmcgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoKGMgJiAxNSkgPDwgMTIpIHwgKChjMiAmIDYzKSA8PCA2KSB8IChjMyAmIDYzKSk7XHJcblx0XHRcdFx0aSArPSAzO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gc3RyaW5nO1xyXG5cdH1cclxuXHJcblx0dmFyIHJlYWRTdHJpbmc9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHRcdGVuY29kaW5nPWVuY29kaW5nfHwndXRmOCc7XHJcblx0XHR2YXIgYnVmZmVyPW5ldyBCdWZmZXIoYmxvY2tzaXplKTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZmZlciwwLGJsb2Nrc2l6ZSxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwic3RyaW5nXCIsbGVuKTtcclxuXHRcdFx0aWYgKGh0bWw1ZnMpIHtcclxuXHRcdFx0XHRpZiAoZW5jb2Rpbmc9PSd1dGY4Jykge1xyXG5cdFx0XHRcdFx0dmFyIHN0cj1kZWNvZGV1dGY4KFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKSkpXHJcblx0XHRcdFx0fSBlbHNlIHsgLy91Y3MyIGlzIDMgdGltZXMgZmFzdGVyXHJcblx0XHRcdFx0XHR2YXIgc3RyPVN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQxNkFycmF5KGJ1ZmZlcikpXHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbc3RyXSk7XHJcblx0XHRcdH0gXHJcblx0XHRcdGVsc2UgY2IuYXBwbHkodGhhdCxbYnVmZmVyLnRvU3RyaW5nKGVuY29kaW5nKV0pO1x0XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vd29yayBhcm91bmQgZm9yIGNocm9tZSBmcm9tQ2hhckNvZGUgY2Fubm90IGFjY2VwdCBodWdlIGFycmF5XHJcblx0Ly9odHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9NTY1ODhcclxuXHR2YXIgYnVmMnN0cmluZ2Fycj1mdW5jdGlvbihidWYsZW5jKSB7XHJcblx0XHRpZiAoZW5jPT1cInV0ZjhcIikgXHR2YXIgYXJyPW5ldyBVaW50OEFycmF5KGJ1Zik7XHJcblx0XHRlbHNlIHZhciBhcnI9bmV3IFVpbnQxNkFycmF5KGJ1Zik7XHJcblx0XHR2YXIgaT0wLGNvZGVzPVtdLG91dD1bXSxzPVwiXCI7XHJcblx0XHR3aGlsZSAoaTxhcnIubGVuZ3RoKSB7XHJcblx0XHRcdGlmIChhcnJbaV0pIHtcclxuXHRcdFx0XHRjb2Rlc1tjb2Rlcy5sZW5ndGhdPWFycltpXTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRzPVN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxjb2Rlcyk7XHJcblx0XHRcdFx0aWYgKGVuYz09XCJ1dGY4XCIpIG91dFtvdXQubGVuZ3RoXT1kZWNvZGV1dGY4KHMpO1xyXG5cdFx0XHRcdGVsc2Ugb3V0W291dC5sZW5ndGhdPXM7XHJcblx0XHRcdFx0Y29kZXM9W107XHRcdFx0XHRcclxuXHRcdFx0fVxyXG5cdFx0XHRpKys7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHM9U3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLGNvZGVzKTtcclxuXHRcdGlmIChlbmM9PVwidXRmOFwiKSBvdXRbb3V0Lmxlbmd0aF09ZGVjb2RldXRmOChzKTtcclxuXHRcdGVsc2Ugb3V0W291dC5sZW5ndGhdPXM7XHJcblxyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblx0dmFyIHJlYWRTdHJpbmdBcnJheSA9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXMsb3V0PW51bGw7XHJcblx0XHRpZiAoYmxvY2tzaXplPT0wKSByZXR1cm4gW107XHJcblx0XHRlbmNvZGluZz1lbmNvZGluZ3x8J3V0ZjgnO1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKGJsb2Nrc2l6ZSk7XHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZmZlciwwLGJsb2Nrc2l6ZSxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRpZiAoaHRtbDVmcykge1xyXG5cdFx0XHRcdHJlYWRMb2coXCJzdHJpbmdBcnJheVwiLGJ1ZmZlci5ieXRlTGVuZ3RoKTtcclxuXHJcblx0XHRcdFx0aWYgKGVuY29kaW5nPT0ndXRmOCcpIHtcclxuXHRcdFx0XHRcdG91dD1idWYyc3RyaW5nYXJyKGJ1ZmZlcixcInV0ZjhcIik7XHJcblx0XHRcdFx0fSBlbHNlIHsgLy91Y3MyIGlzIDMgdGltZXMgZmFzdGVyXHJcblx0XHRcdFx0XHRvdXQ9YnVmMnN0cmluZ2FycihidWZmZXIsXCJ1Y3MyXCIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyZWFkTG9nKFwic3RyaW5nQXJyYXlcIixidWZmZXIubGVuZ3RoKTtcclxuXHRcdFx0XHRvdXQ9YnVmZmVyLnRvU3RyaW5nKGVuY29kaW5nKS5zcGxpdCgnXFwwJyk7XHJcblx0XHRcdH0gXHRcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbb3V0XSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0dmFyIHJlYWRVSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKDQpO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGZzLnJlYWQodGhpcy5oYW5kbGUsYnVmZmVyLDAsNCxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwidWkzMlwiLGxlbik7XHJcblx0XHRcdGlmIChodG1sNWZzKXtcclxuXHRcdFx0XHQvL3Y9KG5ldyBVaW50MzJBcnJheShidWZmZXIpKVswXTtcclxuXHRcdFx0XHR2YXIgdj1uZXcgRGF0YVZpZXcoYnVmZmVyKS5nZXRVaW50MzIoMCwgZmFsc2UpXHJcblx0XHRcdFx0Y2Iodik7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSBjYi5hcHBseSh0aGF0LFtidWZmZXIucmVhZEludDMyQkUoMCldKTtcdFxyXG5cdFx0fSk7XHRcdFxyXG5cdH1cclxuXHJcblx0dmFyIHJlYWRJMzI9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0XHR2YXIgYnVmZmVyPW5ldyBCdWZmZXIoNCk7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxidWZmZXIsMCw0LHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdHJlYWRMb2coXCJpMzJcIixsZW4pO1xyXG5cdFx0XHRpZiAoaHRtbDVmcyl7XHJcblx0XHRcdFx0dmFyIHY9bmV3IERhdGFWaWV3KGJ1ZmZlcikuZ2V0SW50MzIoMCwgZmFsc2UpXHJcblx0XHRcdFx0Y2Iodik7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSAgXHRjYi5hcHBseSh0aGF0LFtidWZmZXIucmVhZEludDMyQkUoMCldKTtcdFxyXG5cdFx0fSk7XHJcblx0fVxyXG5cdHZhciByZWFkVUk4PWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKDEpO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZmZlciwwLDEscG9zLGZ1bmN0aW9uKGVycixsZW4sYnVmZmVyKXtcclxuXHRcdFx0cmVhZExvZyhcInVpOFwiLGxlbik7XHJcblx0XHRcdGlmIChodG1sNWZzKWNiKCAobmV3IFVpbnQ4QXJyYXkoYnVmZmVyKSlbMF0pIDtcclxuXHRcdFx0ZWxzZSAgXHRcdFx0Y2IuYXBwbHkodGhhdCxbYnVmZmVyLnJlYWRVSW50OCgwKV0pO1x0XHJcblx0XHRcdFxyXG5cdFx0fSk7XHJcblx0fVxyXG5cdHZhciByZWFkQnVmPWZ1bmN0aW9uKHBvcyxibG9ja3NpemUsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR2YXIgYnVmPW5ldyBCdWZmZXIoYmxvY2tzaXplKTtcclxuXHRcdGZzLnJlYWQodGhpcy5oYW5kbGUsYnVmLDAsYmxvY2tzaXplLHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdHJlYWRMb2coXCJidWZcIixsZW4pO1xyXG5cdFx0XHR2YXIgYnVmZj1uZXcgVWludDhBcnJheShidWZmZXIpXHJcblx0XHRcdGNiLmFwcGx5KHRoYXQsW2J1ZmZdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHR2YXIgcmVhZEJ1Zl9wYWNrZWRpbnQ9ZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxjb3VudCxyZXNldCxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHJlYWRCdWYuYXBwbHkodGhpcyxbcG9zLGJsb2Nrc2l6ZSxmdW5jdGlvbihidWZmZXIpe1xyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFt1bnBhY2tfaW50KGJ1ZmZlcixjb3VudCxyZXNldCldKTtcdFxyXG5cdFx0fV0pO1xyXG5cdFx0XHJcblx0fVxyXG5cdHZhciByZWFkRml4ZWRBcnJheV9odG1sNWZzPWZ1bmN0aW9uKHBvcyxjb3VudCx1bml0c2l6ZSxjYikge1xyXG5cdFx0dmFyIGZ1bmM9bnVsbDtcclxuXHRcdGlmICh1bml0c2l6ZT09PTEpIHtcclxuXHRcdFx0ZnVuYz0nZ2V0VWludDgnOy8vVWludDhBcnJheTtcclxuXHRcdH0gZWxzZSBpZiAodW5pdHNpemU9PT0yKSB7XHJcblx0XHRcdGZ1bmM9J2dldFVpbnQxNic7Ly9VaW50MTZBcnJheTtcclxuXHRcdH0gZWxzZSBpZiAodW5pdHNpemU9PT00KSB7XHJcblx0XHRcdGZ1bmM9J2dldFVpbnQzMic7Ly9VaW50MzJBcnJheTtcclxuXHRcdH0gZWxzZSB0aHJvdyAndW5zdXBwb3J0ZWQgaW50ZWdlciBzaXplJztcclxuXHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLG51bGwsMCx1bml0c2l6ZSpjb3VudCxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwiZml4IGFycmF5XCIsbGVuKTtcclxuXHRcdFx0dmFyIG91dD1bXTtcclxuXHRcdFx0aWYgKHVuaXRzaXplPT0xKSB7XHJcblx0XHRcdFx0b3V0PW5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsZW4gLyB1bml0c2l6ZTsgaSsrKSB7IC8vZW5kaWFuIHByb2JsZW1cclxuXHRcdFx0XHQvL1x0b3V0LnB1c2goIGZ1bmMoYnVmZmVyLGkqdW5pdHNpemUpKTtcclxuXHRcdFx0XHRcdG91dC5wdXNoKCB2PW5ldyBEYXRhVmlldyhidWZmZXIpW2Z1bmNdKGksZmFsc2UpICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtvdXRdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHQvLyBzaWduYXR1cmUsIGl0ZW1jb3VudCwgcGF5bG9hZFxyXG5cdHZhciByZWFkRml4ZWRBcnJheSA9IGZ1bmN0aW9uKHBvcyAsY291bnQsIHVuaXRzaXplLGNiKSB7XHJcblx0XHR2YXIgZnVuYz1udWxsO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdFxyXG5cdFx0aWYgKHVuaXRzaXplKiBjb3VudD50aGlzLnNpemUgJiYgdGhpcy5zaXplKSAge1xyXG5cdFx0XHRjb25zb2xlLmxvZyhcImFycmF5IHNpemUgZXhjZWVkIGZpbGUgc2l6ZVwiLHRoaXMuc2l6ZSlcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRpZiAoaHRtbDVmcykgcmV0dXJuIHJlYWRGaXhlZEFycmF5X2h0bWw1ZnMuYXBwbHkodGhpcyxbcG9zLGNvdW50LHVuaXRzaXplLGNiXSk7XHJcblxyXG5cdFx0dmFyIGl0ZW1zPW5ldyBCdWZmZXIoIHVuaXRzaXplKiBjb3VudCk7XHJcblx0XHRpZiAodW5pdHNpemU9PT0xKSB7XHJcblx0XHRcdGZ1bmM9aXRlbXMucmVhZFVJbnQ4O1xyXG5cdFx0fSBlbHNlIGlmICh1bml0c2l6ZT09PTIpIHtcclxuXHRcdFx0ZnVuYz1pdGVtcy5yZWFkVUludDE2QkU7XHJcblx0XHR9IGVsc2UgaWYgKHVuaXRzaXplPT09NCkge1xyXG5cdFx0XHRmdW5jPWl0ZW1zLnJlYWRVSW50MzJCRTtcclxuXHRcdH0gZWxzZSB0aHJvdyAndW5zdXBwb3J0ZWQgaW50ZWdlciBzaXplJztcclxuXHRcdC8vY29uc29sZS5sb2coJ2l0ZW1jb3VudCcsaXRlbWNvdW50LCdidWZmZXInLGJ1ZmZlcik7XHJcblxyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxpdGVtcywwLHVuaXRzaXplKmNvdW50LHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdHJlYWRMb2coXCJmaXggYXJyYXlcIixsZW4pO1xyXG5cdFx0XHR2YXIgb3V0PVtdO1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aCAvIHVuaXRzaXplOyBpKyspIHtcclxuXHRcdFx0XHRvdXQucHVzaCggZnVuYy5hcHBseShpdGVtcyxbaSp1bml0c2l6ZV0pKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtvdXRdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0dmFyIGZyZWU9ZnVuY3Rpb24oKSB7XHJcblx0XHQvL2NvbnNvbGUubG9nKCdjbG9zaW5nICcsaGFuZGxlKTtcclxuXHRcdGZzLmNsb3NlU3luYyh0aGlzLmhhbmRsZSk7XHJcblx0fVxyXG5cdHZhciBzZXR1cGFwaT1mdW5jdGlvbigpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR0aGlzLnJlYWRTaWduYXR1cmU9cmVhZFNpZ25hdHVyZTtcclxuXHRcdHRoaXMucmVhZEkzMj1yZWFkSTMyO1xyXG5cdFx0dGhpcy5yZWFkVUkzMj1yZWFkVUkzMjtcclxuXHRcdHRoaXMucmVhZFVJOD1yZWFkVUk4O1xyXG5cdFx0dGhpcy5yZWFkQnVmPXJlYWRCdWY7XHJcblx0XHR0aGlzLnJlYWRCdWZfcGFja2VkaW50PXJlYWRCdWZfcGFja2VkaW50O1xyXG5cdFx0dGhpcy5yZWFkRml4ZWRBcnJheT1yZWFkRml4ZWRBcnJheTtcclxuXHRcdHRoaXMucmVhZFN0cmluZz1yZWFkU3RyaW5nO1xyXG5cdFx0dGhpcy5yZWFkU3RyaW5nQXJyYXk9cmVhZFN0cmluZ0FycmF5O1xyXG5cdFx0dGhpcy5zaWduYXR1cmVfc2l6ZT1zaWduYXR1cmVfc2l6ZTtcclxuXHRcdHRoaXMuZnJlZT1mcmVlO1xyXG5cdFx0aWYgKGh0bWw1ZnMpIHtcclxuXHRcdFx0dmFyIGZuPXBhdGg7XHJcblx0XHRcdGlmIChwYXRoLmluZGV4T2YoXCJmaWxlc3lzdGVtOlwiKT09MCkgZm49cGF0aC5zdWJzdHIocGF0aC5sYXN0SW5kZXhPZihcIi9cIikpO1xyXG5cdFx0XHRmcy5mcy5yb290LmdldEZpbGUoZm4se30sZnVuY3Rpb24oZW50cnkpe1xyXG5cdFx0XHQgIGVudHJ5LmdldE1ldGFkYXRhKGZ1bmN0aW9uKG1ldGFkYXRhKSB7IFxyXG5cdFx0XHRcdHRoYXQuc2l6ZT1tZXRhZGF0YS5zaXplO1xyXG5cdFx0XHRcdGlmIChjYikgc2V0VGltZW91dChjYi5iaW5kKHRoYXQpLDApO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHZhciBzdGF0PWZzLmZzdGF0U3luYyh0aGlzLmhhbmRsZSk7XHJcblx0XHRcdHRoaXMuc3RhdD1zdGF0O1xyXG5cdFx0XHR0aGlzLnNpemU9c3RhdC5zaXplO1x0XHRcclxuXHRcdFx0aWYgKGNiKVx0c2V0VGltZW91dChjYi5iaW5kKHRoaXMsMCksMCk7XHRcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciB0aGF0PXRoaXM7XHJcblx0aWYgKGh0bWw1ZnMpIHtcclxuXHRcdGZzLm9wZW4ocGF0aCxmdW5jdGlvbihoKXtcclxuXHRcdFx0dGhhdC5oYW5kbGU9aDtcclxuXHRcdFx0dGhhdC5odG1sNWZzPXRydWU7XHJcblx0XHRcdHNldHVwYXBpLmNhbGwodGhhdCk7XHJcblx0XHRcdHRoYXQub3BlbmVkPXRydWU7XHJcblx0XHR9KVxyXG5cdH0gZWxzZSB7XHJcblx0XHRpZiAoZnMuZXhpc3RzU3luYyhwYXRoKSl7XHJcblx0XHRcdHRoaXMuaGFuZGxlPWZzLm9wZW5TeW5jKHBhdGgsJ3InKTsvLyxmdW5jdGlvbihlcnIsaGFuZGxlKXtcclxuXHRcdFx0dGhpcy5vcGVuZWQ9dHJ1ZTtcclxuXHRcdFx0c2V0dXBhcGkuY2FsbCh0aGlzKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGlmIChjYilcdHNldFRpbWVvdXQoY2IuYmluZChudWxsLFwiZmlsZSBub3QgZm91bmQ6XCIrcGF0aCksMCk7XHRcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiB0aGlzO1xyXG59XHJcbm1vZHVsZS5leHBvcnRzPU9wZW47IiwiLypcclxuICBKQVZBIGNhbiBvbmx5IHJldHVybiBOdW1iZXIgYW5kIFN0cmluZ1xyXG5cdGFycmF5IGFuZCBidWZmZXIgcmV0dXJuIGluIHN0cmluZyBmb3JtYXRcclxuXHRuZWVkIEpTT04ucGFyc2VcclxuKi9cclxudmFyIHZlcmJvc2U9MDtcclxuXHJcbnZhciByZWFkU2lnbmF0dXJlPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCBzaWduYXR1cmVcIik7XHJcblx0dmFyIHNpZ25hdHVyZT1rZnMucmVhZFVURjhTdHJpbmcodGhpcy5oYW5kbGUscG9zLDEpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKHNpZ25hdHVyZSxzaWduYXR1cmUuY2hhckNvZGVBdCgwKSk7XHJcblx0Y2IuYXBwbHkodGhpcyxbc2lnbmF0dXJlXSk7XHJcbn1cclxudmFyIHJlYWRJMzI9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkIGkzMiBhdCBcIitwb3MpO1xyXG5cdHZhciBpMzI9a2ZzLnJlYWRJbnQzMih0aGlzLmhhbmRsZSxwb3MpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKGkzMik7XHJcblx0Y2IuYXBwbHkodGhpcyxbaTMyXSk7XHRcclxufVxyXG52YXIgcmVhZFVJMzI9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkIHVpMzIgYXQgXCIrcG9zKTtcclxuXHR2YXIgdWkzMj1rZnMucmVhZFVJbnQzMih0aGlzLmhhbmRsZSxwb3MpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKHVpMzIpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW3VpMzJdKTtcclxufVxyXG52YXIgcmVhZFVJOD1mdW5jdGlvbihwb3MsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInJlYWQgdWk4IGF0IFwiK3Bvcyk7IFxyXG5cdHZhciB1aTg9a2ZzLnJlYWRVSW50OCh0aGlzLmhhbmRsZSxwb3MpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKHVpOCk7XHJcblx0Y2IuYXBwbHkodGhpcyxbdWk4XSk7XHJcbn1cclxudmFyIHJlYWRCdWY9ZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCBidWZmZXIgYXQgXCIrcG9zKyBcIiBibG9ja3NpemUgXCIrYmxvY2tzaXplKTtcclxuXHR2YXIgYnVmPWtmcy5yZWFkQnVmKHRoaXMuaGFuZGxlLHBvcyxibG9ja3NpemUpO1xyXG5cdHZhciBidWZmPUpTT04ucGFyc2UoYnVmKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcImJ1ZmZlciBsZW5ndGhcIitidWZmLmxlbmd0aCk7XHJcblx0Y2IuYXBwbHkodGhpcyxbYnVmZl0pO1x0XHJcbn1cclxudmFyIHJlYWRCdWZfcGFja2VkaW50PWZ1bmN0aW9uKHBvcyxibG9ja3NpemUsY291bnQscmVzZXQsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInJlYWQgcGFja2VkIGludCBhdCBcIitwb3MrXCIgYmxvY2tzaXplIFwiK2Jsb2Nrc2l6ZStcIiBjb3VudCBcIitjb3VudCk7XHJcblx0dmFyIGJ1Zj1rZnMucmVhZEJ1Zl9wYWNrZWRpbnQodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSxjb3VudCxyZXNldCk7XHJcblx0dmFyIGFkdj1wYXJzZUludChidWYpO1xyXG5cdHZhciBidWZmPUpTT04ucGFyc2UoYnVmLnN1YnN0cihidWYuaW5kZXhPZihcIltcIikpKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInBhY2tlZEludCBsZW5ndGggXCIrYnVmZi5sZW5ndGgrXCIgZmlyc3QgaXRlbT1cIitidWZmWzBdKTtcclxuXHRjYi5hcHBseSh0aGlzLFt7ZGF0YTpidWZmLGFkdjphZHZ9XSk7XHRcclxufVxyXG5cclxuXHJcbnZhciByZWFkU3RyaW5nPSBmdW5jdGlvbihwb3MsYmxvY2tzaXplLGVuY29kaW5nLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkc3RyaW5nIGF0IFwiK3BvcytcIiBibG9ja3NpemUgXCIgK2Jsb2Nrc2l6ZStcIiBlbmM6XCIrZW5jb2RpbmcpO1xyXG5cdGlmIChlbmNvZGluZz09XCJ1Y3MyXCIpIHtcclxuXHRcdHZhciBzdHI9a2ZzLnJlYWRVTEUxNlN0cmluZyh0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dmFyIHN0cj1rZnMucmVhZFVURjhTdHJpbmcodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSk7XHRcclxuXHR9XHQgXHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoc3RyKTtcclxuXHRjYi5hcHBseSh0aGlzLFtzdHJdKTtcdFxyXG59XHJcblxyXG52YXIgcmVhZEZpeGVkQXJyYXkgPSBmdW5jdGlvbihwb3MgLGNvdW50LCB1bml0c2l6ZSxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCBmaXhlZCBhcnJheSBhdCBcIitwb3MrXCIgY291bnQgXCIrY291bnQrXCIgdW5pdHNpemUgXCIrdW5pdHNpemUpOyBcclxuXHR2YXIgYnVmPWtmcy5yZWFkRml4ZWRBcnJheSh0aGlzLmhhbmRsZSxwb3MsY291bnQsdW5pdHNpemUpO1xyXG5cdHZhciBidWZmPUpTT04ucGFyc2UoYnVmKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcImFycmF5IGxlbmd0aFwiK2J1ZmYubGVuZ3RoKTtcclxuXHRjYi5hcHBseSh0aGlzLFtidWZmXSk7XHRcclxufVxyXG52YXIgcmVhZFN0cmluZ0FycmF5ID0gZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxlbmNvZGluZyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmxvZyhcInJlYWQgU3RyaW5nIGFycmF5IGF0IFwiK3BvcytcIiBibG9ja3NpemUgXCIrYmxvY2tzaXplICtcIiBlbmMgXCIrZW5jb2RpbmcpOyBcclxuXHRlbmNvZGluZyA9IGVuY29kaW5nfHxcInV0ZjhcIjtcclxuXHR2YXIgYnVmPWtmcy5yZWFkU3RyaW5nQXJyYXkodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSxlbmNvZGluZyk7XHJcblx0Ly92YXIgYnVmZj1KU09OLnBhcnNlKGJ1Zik7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkIHN0cmluZyBhcnJheVwiKTtcclxuXHR2YXIgYnVmZj1idWYuc3BsaXQoXCJcXHVmZmZmXCIpOyAvL2Nhbm5vdCByZXR1cm4gc3RyaW5nIHdpdGggMFxyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwiYXJyYXkgbGVuZ3RoXCIrYnVmZi5sZW5ndGgpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2J1ZmZdKTtcdFxyXG59XHJcbnZhciBtZXJnZVBvc3RpbmdzPWZ1bmN0aW9uKHBvc2l0aW9ucyxjYikge1xyXG5cdHZhciBidWY9a2ZzLm1lcmdlUG9zdGluZ3ModGhpcy5oYW5kbGUsSlNPTi5zdHJpbmdpZnkocG9zaXRpb25zKSk7XHJcblx0aWYgKCFidWYgfHwgYnVmLmxlbmd0aD09MCkgcmV0dXJuIFtdO1xyXG5cdGVsc2UgcmV0dXJuIEpTT04ucGFyc2UoYnVmKTtcclxufVxyXG5cclxudmFyIGZyZWU9ZnVuY3Rpb24oKSB7XHJcblx0Ly9jb25zb2xlLmxvZygnY2xvc2luZyAnLGhhbmRsZSk7XHJcblx0a2ZzLmNsb3NlKHRoaXMuaGFuZGxlKTtcclxufVxyXG52YXIgT3Blbj1mdW5jdGlvbihwYXRoLG9wdHMsY2IpIHtcclxuXHRvcHRzPW9wdHN8fHt9O1xyXG5cdHZhciBzaWduYXR1cmVfc2l6ZT0xO1xyXG5cdHZhciBzZXR1cGFwaT1mdW5jdGlvbigpIHsgXHJcblx0XHR0aGlzLnJlYWRTaWduYXR1cmU9cmVhZFNpZ25hdHVyZTtcclxuXHRcdHRoaXMucmVhZEkzMj1yZWFkSTMyO1xyXG5cdFx0dGhpcy5yZWFkVUkzMj1yZWFkVUkzMjtcclxuXHRcdHRoaXMucmVhZFVJOD1yZWFkVUk4O1xyXG5cdFx0dGhpcy5yZWFkQnVmPXJlYWRCdWY7XHJcblx0XHR0aGlzLnJlYWRCdWZfcGFja2VkaW50PXJlYWRCdWZfcGFja2VkaW50O1xyXG5cdFx0dGhpcy5yZWFkRml4ZWRBcnJheT1yZWFkRml4ZWRBcnJheTtcclxuXHRcdHRoaXMucmVhZFN0cmluZz1yZWFkU3RyaW5nO1xyXG5cdFx0dGhpcy5yZWFkU3RyaW5nQXJyYXk9cmVhZFN0cmluZ0FycmF5O1xyXG5cdFx0dGhpcy5zaWduYXR1cmVfc2l6ZT1zaWduYXR1cmVfc2l6ZTtcclxuXHRcdHRoaXMubWVyZ2VQb3N0aW5ncz1tZXJnZVBvc3RpbmdzO1xyXG5cdFx0dGhpcy5mcmVlPWZyZWU7XHJcblx0XHR0aGlzLnNpemU9a2ZzLmdldEZpbGVTaXplKHRoaXMuaGFuZGxlKTtcclxuXHRcdGlmICh2ZXJib3NlKSBjb25zb2xlLmxvZyhcImZpbGVzaXplICBcIit0aGlzLnNpemUpO1xyXG5cdFx0aWYgKGNiKVx0Y2IuY2FsbCh0aGlzKTtcclxuXHR9XHJcblxyXG5cdHRoaXMuaGFuZGxlPWtmcy5vcGVuKHBhdGgpO1xyXG5cdHRoaXMub3BlbmVkPXRydWU7XHJcblx0c2V0dXBhcGkuY2FsbCh0aGlzKTtcclxuXHRyZXR1cm4gdGhpcztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHM9T3BlbjsiLCIvKlxyXG4gIEpTQ29udGV4dCBjYW4gcmV0dXJuIGFsbCBKYXZhc2NyaXB0IHR5cGVzLlxyXG4qL1xyXG52YXIgdmVyYm9zZT0xO1xyXG5cclxudmFyIHJlYWRTaWduYXR1cmU9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZWFkIHNpZ25hdHVyZSBhdCBcIitwb3MpO1xyXG5cdHZhciBzaWduYXR1cmU9a2ZzLnJlYWRVVEY4U3RyaW5nKHRoaXMuaGFuZGxlLHBvcywxKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhzaWduYXR1cmUrXCIgXCIrc2lnbmF0dXJlLmNoYXJDb2RlQXQoMCkpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW3NpZ25hdHVyZV0pO1xyXG59XHJcbnZhciByZWFkSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBpMzIgYXQgXCIrcG9zKTtcclxuXHR2YXIgaTMyPWtmcy5yZWFkSW50MzIodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhpMzIpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2kzMl0pO1x0XHJcbn1cclxudmFyIHJlYWRVSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCB1aTMyIGF0IFwiK3Bvcyk7XHJcblx0dmFyIHVpMzI9a2ZzLnJlYWRVSW50MzIodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyh1aTMyKTtcclxuXHRjYi5hcHBseSh0aGlzLFt1aTMyXSk7XHJcbn1cclxudmFyIHJlYWRVSTg9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZWFkIHVpOCBhdCBcIitwb3MpOyBcclxuXHR2YXIgdWk4PWtmcy5yZWFkVUludDgodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyh1aTgpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW3VpOF0pO1xyXG59XHJcbnZhciByZWFkQnVmPWZ1bmN0aW9uKHBvcyxibG9ja3NpemUsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWQgYnVmZmVyIGF0IFwiK3Bvcyk7XHJcblx0dmFyIGJ1Zj1rZnMucmVhZEJ1Zih0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcImJ1ZmZlciBsZW5ndGhcIitidWYubGVuZ3RoKTtcclxuXHRjYi5hcHBseSh0aGlzLFtidWZdKTtcdFxyXG59XHJcbnZhciByZWFkQnVmX3BhY2tlZGludD1mdW5jdGlvbihwb3MsYmxvY2tzaXplLGNvdW50LHJlc2V0LGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZWFkIHBhY2tlZCBpbnQgZmFzdCwgYmxvY2tzaXplIFwiK2Jsb2Nrc2l6ZStcIiBhdCBcIitwb3MpO3ZhciB0PW5ldyBEYXRlKCk7XHJcblx0dmFyIGJ1Zj1rZnMucmVhZEJ1Zl9wYWNrZWRpbnQodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSxjb3VudCxyZXNldCk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZXR1cm4gZnJvbSBwYWNrZWRpbnQsIHRpbWVcIiArIChuZXcgRGF0ZSgpLXQpKTtcclxuXHRpZiAodHlwZW9mIGJ1Zi5kYXRhPT1cInN0cmluZ1wiKSB7XHJcblx0XHRidWYuZGF0YT1ldmFsKFwiW1wiK2J1Zi5kYXRhLnN1YnN0cigwLGJ1Zi5kYXRhLmxlbmd0aC0xKStcIl1cIik7XHJcblx0fVxyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwidW5wYWNrZWQgbGVuZ3RoXCIrYnVmLmRhdGEubGVuZ3RoK1wiIHRpbWVcIiArIChuZXcgRGF0ZSgpLXQpICk7XHJcblx0Y2IuYXBwbHkodGhpcyxbYnVmXSk7XHJcbn1cclxuXHJcblxyXG52YXIgcmVhZFN0cmluZz0gZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxlbmNvZGluZyxjYikge1xyXG5cclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWRzdHJpbmcgYXQgXCIrcG9zK1wiIGJsb2Nrc2l6ZSBcIitibG9ja3NpemUrXCIgXCIrZW5jb2RpbmcpO3ZhciB0PW5ldyBEYXRlKCk7XHJcblx0aWYgKGVuY29kaW5nPT1cInVjczJcIikge1xyXG5cdFx0dmFyIHN0cj1rZnMucmVhZFVMRTE2U3RyaW5nKHRoaXMuaGFuZGxlLHBvcyxibG9ja3NpemUpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR2YXIgc3RyPWtmcy5yZWFkVVRGOFN0cmluZyh0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplKTtcdFxyXG5cdH1cclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhzdHIrXCIgdGltZVwiKyhuZXcgRGF0ZSgpLXQpKTtcclxuXHRjYi5hcHBseSh0aGlzLFtzdHJdKTtcdFxyXG59XHJcblxyXG52YXIgcmVhZEZpeGVkQXJyYXkgPSBmdW5jdGlvbihwb3MgLGNvdW50LCB1bml0c2l6ZSxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBmaXhlZCBhcnJheSBhdCBcIitwb3MpOyB2YXIgdD1uZXcgRGF0ZSgpO1xyXG5cdHZhciBidWY9a2ZzLnJlYWRGaXhlZEFycmF5KHRoaXMuaGFuZGxlLHBvcyxjb3VudCx1bml0c2l6ZSk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJhcnJheSBsZW5ndGggXCIrYnVmLmxlbmd0aCtcIiB0aW1lXCIrKG5ldyBEYXRlKCktdCkpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2J1Zl0pO1x0XHJcbn1cclxudmFyIHJlYWRTdHJpbmdBcnJheSA9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHQvL2lmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBTdHJpbmcgYXJyYXkgXCIrYmxvY2tzaXplICtcIiBcIitlbmNvZGluZyk7IFxyXG5cdGVuY29kaW5nID0gZW5jb2Rpbmd8fFwidXRmOFwiO1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBzdHJpbmcgYXJyYXkgYXQgXCIrcG9zKTt2YXIgdD1uZXcgRGF0ZSgpO1xyXG5cdHZhciBidWY9a2ZzLnJlYWRTdHJpbmdBcnJheSh0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplLGVuY29kaW5nKTtcclxuXHRpZiAodHlwZW9mIGJ1Zj09XCJzdHJpbmdcIikgYnVmPWJ1Zi5zcGxpdChcIlxcMFwiKTtcclxuXHQvL3ZhciBidWZmPUpTT04ucGFyc2UoYnVmKTtcclxuXHQvL3ZhciBidWZmPWJ1Zi5zcGxpdChcIlxcdWZmZmZcIik7IC8vY2Fubm90IHJldHVybiBzdHJpbmcgd2l0aCAwXHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJzdHJpbmcgYXJyYXkgbGVuZ3RoXCIrYnVmLmxlbmd0aCtcIiB0aW1lXCIrKG5ldyBEYXRlKCktdCkpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2J1Zl0pO1xyXG59XHJcblxyXG52YXIgbWVyZ2VQb3N0aW5ncz1mdW5jdGlvbihwb3NpdGlvbnMpIHtcclxuXHR2YXIgYnVmPWtmcy5tZXJnZVBvc3RpbmdzKHRoaXMuaGFuZGxlLHBvc2l0aW9ucyk7XHJcblx0aWYgKHR5cGVvZiBidWY9PVwic3RyaW5nXCIpIHtcclxuXHRcdGJ1Zj1ldmFsKFwiW1wiK2J1Zi5zdWJzdHIoMCxidWYubGVuZ3RoLTEpK1wiXVwiKTtcclxuXHR9XHJcblx0cmV0dXJuIGJ1ZjtcclxufVxyXG52YXIgZnJlZT1mdW5jdGlvbigpIHtcclxuXHQvLy8vaWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coJ2Nsb3NpbmcgJyxoYW5kbGUpO1xyXG5cdGtmcy5jbG9zZSh0aGlzLmhhbmRsZSk7XHJcbn1cclxudmFyIE9wZW49ZnVuY3Rpb24ocGF0aCxvcHRzLGNiKSB7XHJcblx0b3B0cz1vcHRzfHx7fTtcclxuXHR2YXIgc2lnbmF0dXJlX3NpemU9MTtcclxuXHR2YXIgc2V0dXBhcGk9ZnVuY3Rpb24oKSB7IFxyXG5cdFx0dGhpcy5yZWFkU2lnbmF0dXJlPXJlYWRTaWduYXR1cmU7XHJcblx0XHR0aGlzLnJlYWRJMzI9cmVhZEkzMjtcclxuXHRcdHRoaXMucmVhZFVJMzI9cmVhZFVJMzI7XHJcblx0XHR0aGlzLnJlYWRVSTg9cmVhZFVJODtcclxuXHRcdHRoaXMucmVhZEJ1Zj1yZWFkQnVmO1xyXG5cdFx0dGhpcy5yZWFkQnVmX3BhY2tlZGludD1yZWFkQnVmX3BhY2tlZGludDtcclxuXHRcdHRoaXMucmVhZEZpeGVkQXJyYXk9cmVhZEZpeGVkQXJyYXk7XHJcblx0XHR0aGlzLnJlYWRTdHJpbmc9cmVhZFN0cmluZztcclxuXHRcdHRoaXMucmVhZFN0cmluZ0FycmF5PXJlYWRTdHJpbmdBcnJheTtcclxuXHRcdHRoaXMuc2lnbmF0dXJlX3NpemU9c2lnbmF0dXJlX3NpemU7XHJcblx0XHR0aGlzLm1lcmdlUG9zdGluZ3M9bWVyZ2VQb3N0aW5ncztcclxuXHRcdHRoaXMuZnJlZT1mcmVlO1xyXG5cdFx0dGhpcy5zaXplPWtmcy5nZXRGaWxlU2l6ZSh0aGlzLmhhbmRsZSk7XHJcblx0XHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcImZpbGVzaXplICBcIit0aGlzLnNpemUpO1xyXG5cdFx0aWYgKGNiKVx0Y2IuY2FsbCh0aGlzKTtcclxuXHR9XHJcblxyXG5cdHRoaXMuaGFuZGxlPWtmcy5vcGVuKHBhdGgpO1xyXG5cdHRoaXMub3BlbmVkPXRydWU7XHJcblx0c2V0dXBhcGkuY2FsbCh0aGlzKTtcclxuXHRyZXR1cm4gdGhpcztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHM9T3BlbjsiLCIvKlxyXG4gIGNvbnZlcnQgYW55IGpzb24gaW50byBhIGJpbmFyeSBidWZmZXJcclxuICB0aGUgYnVmZmVyIGNhbiBiZSBzYXZlZCB3aXRoIGEgc2luZ2xlIGxpbmUgb2YgZnMud3JpdGVGaWxlXHJcbiovXHJcblxyXG52YXIgRFQ9e1xyXG5cdHVpbnQ4OicxJywgLy91bnNpZ25lZCAxIGJ5dGUgaW50ZWdlclxyXG5cdGludDMyOic0JywgLy8gc2lnbmVkIDQgYnl0ZXMgaW50ZWdlclxyXG5cdHV0Zjg6JzgnLCAgXHJcblx0dWNzMjonMicsXHJcblx0Ym9vbDonXicsIFxyXG5cdGJsb2I6JyYnLFxyXG5cdHV0ZjhhcnI6JyonLCAvL3NoaWZ0IG9mIDhcclxuXHR1Y3MyYXJyOidAJywgLy9zaGlmdCBvZiAyXHJcblx0dWludDhhcnI6JyEnLCAvL3NoaWZ0IG9mIDFcclxuXHRpbnQzMmFycjonJCcsIC8vc2hpZnQgb2YgNFxyXG5cdHZpbnQ6J2AnLFxyXG5cdHBpbnQ6J34nLFx0XHJcblxyXG5cdGFycmF5OidcXHUwMDFiJyxcclxuXHRvYmplY3Q6J1xcdTAwMWEnIFxyXG5cdC8veWRiIHN0YXJ0IHdpdGggb2JqZWN0IHNpZ25hdHVyZSxcclxuXHQvL3R5cGUgYSB5ZGIgaW4gY29tbWFuZCBwcm9tcHQgc2hvd3Mgbm90aGluZ1xyXG59XHJcbnZhciBrZXlfd3JpdGluZz1cIlwiOy8vZm9yIGRlYnVnZ2luZ1xyXG52YXIgcGFja19pbnQgPSBmdW5jdGlvbiAoYXIsIHNhdmVkZWx0YSkgeyAvLyBwYWNrIGFyIGludG9cclxuICBpZiAoIWFyIHx8IGFyLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdOyAvLyBlbXB0eSBhcnJheVxyXG4gIHZhciByID0gW10sXHJcbiAgaSA9IDAsXHJcbiAgaiA9IDAsXHJcbiAgZGVsdGEgPSAwLFxyXG4gIHByZXYgPSAwO1xyXG4gIFxyXG4gIGRvIHtcclxuXHRkZWx0YSA9IGFyW2ldO1xyXG5cdGlmIChzYXZlZGVsdGEpIHtcclxuXHRcdGRlbHRhIC09IHByZXY7XHJcblx0fVxyXG5cdGlmIChkZWx0YSA8IDApIHtcclxuXHQgIGNvbnNvbGUudHJhY2UoJ25lZ2F0aXZlJyxwcmV2LGFyW2ldKVxyXG5cdCAgdGhyb3cgJ25lZ2V0aXZlJztcclxuXHQgIGJyZWFrO1xyXG5cdH1cclxuXHRcclxuXHRyW2orK10gPSBkZWx0YSAmIDB4N2Y7XHJcblx0ZGVsdGEgPj49IDc7XHJcblx0d2hpbGUgKGRlbHRhID4gMCkge1xyXG5cdCAgcltqKytdID0gKGRlbHRhICYgMHg3ZikgfCAweDgwO1xyXG5cdCAgZGVsdGEgPj49IDc7XHJcblx0fVxyXG5cdHByZXYgPSBhcltpXTtcclxuXHRpKys7XHJcbiAgfSB3aGlsZSAoaSA8IGFyLmxlbmd0aCk7XHJcbiAgcmV0dXJuIHI7XHJcbn1cclxudmFyIEtmcz1mdW5jdGlvbihwYXRoLG9wdHMpIHtcclxuXHRcclxuXHR2YXIgaGFuZGxlPW51bGw7XHJcblx0b3B0cz1vcHRzfHx7fTtcclxuXHRvcHRzLnNpemU9b3B0cy5zaXplfHw2NTUzNioyMDQ4OyBcclxuXHRjb25zb2xlLmxvZygna2RiIGVzdGltYXRlIHNpemU6JyxvcHRzLnNpemUpO1xyXG5cdHZhciBkYnVmPW5ldyBCdWZmZXIob3B0cy5zaXplKTtcclxuXHR2YXIgY3VyPTA7Ly9kYnVmIGN1cnNvclxyXG5cdFxyXG5cdHZhciB3cml0ZVNpZ25hdHVyZT1mdW5jdGlvbih2YWx1ZSxwb3MpIHtcclxuXHRcdGRidWYud3JpdGUodmFsdWUscG9zLHZhbHVlLmxlbmd0aCwndXRmOCcpO1xyXG5cdFx0aWYgKHBvcyt2YWx1ZS5sZW5ndGg+Y3VyKSBjdXI9cG9zK3ZhbHVlLmxlbmd0aDtcclxuXHRcdHJldHVybiB2YWx1ZS5sZW5ndGg7XHJcblx0fVxyXG5cdHZhciB3cml0ZU9mZnNldD1mdW5jdGlvbih2YWx1ZSxwb3MpIHtcclxuXHRcdGRidWYud3JpdGVVSW50OChNYXRoLmZsb29yKHZhbHVlIC8gKDY1NTM2KjY1NTM2KSkscG9zKTtcclxuXHRcdGRidWYud3JpdGVVSW50MzJCRSggdmFsdWUgJiAweEZGRkZGRkZGLHBvcysxKTtcclxuXHRcdGlmIChwb3MrNT5jdXIpIGN1cj1wb3MrNTtcclxuXHRcdHJldHVybiA1O1xyXG5cdH1cclxuXHR2YXIgd3JpdGVTdHJpbmc9IGZ1bmN0aW9uKHZhbHVlLHBvcyxlbmNvZGluZykge1xyXG5cdFx0ZW5jb2Rpbmc9ZW5jb2Rpbmd8fCd1Y3MyJztcclxuXHRcdGlmICh2YWx1ZT09XCJcIikgdGhyb3cgXCJjYW5ub3Qgd3JpdGUgbnVsbCBzdHJpbmdcIjtcclxuXHRcdGlmIChlbmNvZGluZz09PSd1dGY4JylkYnVmLndyaXRlKERULnV0ZjgscG9zLDEsJ3V0ZjgnKTtcclxuXHRcdGVsc2UgaWYgKGVuY29kaW5nPT09J3VjczInKWRidWYud3JpdGUoRFQudWNzMixwb3MsMSwndXRmOCcpO1xyXG5cdFx0ZWxzZSB0aHJvdyAndW5zdXBwb3J0ZWQgZW5jb2RpbmcgJytlbmNvZGluZztcclxuXHRcdFx0XHJcblx0XHR2YXIgbGVuPUJ1ZmZlci5ieXRlTGVuZ3RoKHZhbHVlLCBlbmNvZGluZyk7XHJcblx0XHRkYnVmLndyaXRlKHZhbHVlLHBvcysxLGxlbixlbmNvZGluZyk7XHJcblx0XHRcclxuXHRcdGlmIChwb3MrbGVuKzE+Y3VyKSBjdXI9cG9zK2xlbisxO1xyXG5cdFx0cmV0dXJuIGxlbisxOyAvLyBzaWduYXR1cmVcclxuXHR9XHJcblx0dmFyIHdyaXRlU3RyaW5nQXJyYXkgPSBmdW5jdGlvbih2YWx1ZSxwb3MsZW5jb2RpbmcpIHtcclxuXHRcdGVuY29kaW5nPWVuY29kaW5nfHwndWNzMic7XHJcblx0XHRpZiAoZW5jb2Rpbmc9PT0ndXRmOCcpIGRidWYud3JpdGUoRFQudXRmOGFycixwb3MsMSwndXRmOCcpO1xyXG5cdFx0ZWxzZSBpZiAoZW5jb2Rpbmc9PT0ndWNzMicpZGJ1Zi53cml0ZShEVC51Y3MyYXJyLHBvcywxLCd1dGY4Jyk7XHJcblx0XHRlbHNlIHRocm93ICd1bnN1cHBvcnRlZCBlbmNvZGluZyAnK2VuY29kaW5nO1xyXG5cdFx0XHJcblx0XHR2YXIgdj12YWx1ZS5qb2luKCdcXDAnKTtcclxuXHRcdHZhciBsZW49QnVmZmVyLmJ5dGVMZW5ndGgodiwgZW5jb2RpbmcpO1xyXG5cdFx0aWYgKDA9PT1sZW4pIHtcclxuXHRcdFx0dGhyb3cgXCJlbXB0eSBzdHJpbmcgYXJyYXkgXCIgKyBrZXlfd3JpdGluZztcclxuXHRcdH1cclxuXHRcdGRidWYud3JpdGUodixwb3MrMSxsZW4sZW5jb2RpbmcpO1xyXG5cdFx0aWYgKHBvcytsZW4rMT5jdXIpIGN1cj1wb3MrbGVuKzE7XHJcblx0XHRyZXR1cm4gbGVuKzE7XHJcblx0fVxyXG5cdHZhciB3cml0ZUkzMj1mdW5jdGlvbih2YWx1ZSxwb3MpIHtcclxuXHRcdGRidWYud3JpdGUoRFQuaW50MzIscG9zLDEsJ3V0ZjgnKTtcclxuXHRcdGRidWYud3JpdGVJbnQzMkJFKHZhbHVlLHBvcysxKTtcclxuXHRcdGlmIChwb3MrNT5jdXIpIGN1cj1wb3MrNTtcclxuXHRcdHJldHVybiA1O1xyXG5cdH1cclxuXHR2YXIgd3JpdGVVSTg9ZnVuY3Rpb24odmFsdWUscG9zKSB7XHJcblx0XHRkYnVmLndyaXRlKERULnVpbnQ4LHBvcywxLCd1dGY4Jyk7XHJcblx0XHRkYnVmLndyaXRlVUludDgodmFsdWUscG9zKzEpO1xyXG5cdFx0aWYgKHBvcysyPmN1cikgY3VyPXBvcysyO1xyXG5cdFx0cmV0dXJuIDI7XHJcblx0fVxyXG5cdHZhciB3cml0ZUJvb2w9ZnVuY3Rpb24odmFsdWUscG9zKSB7XHJcblx0XHRkYnVmLndyaXRlKERULmJvb2wscG9zLDEsJ3V0ZjgnKTtcclxuXHRcdGRidWYud3JpdGVVSW50OChOdW1iZXIodmFsdWUpLHBvcysxKTtcclxuXHRcdGlmIChwb3MrMj5jdXIpIGN1cj1wb3MrMjtcclxuXHRcdHJldHVybiAyO1xyXG5cdH1cdFx0XHJcblx0dmFyIHdyaXRlQmxvYj1mdW5jdGlvbih2YWx1ZSxwb3MpIHtcclxuXHRcdGRidWYud3JpdGUoRFQuYmxvYixwb3MsMSwndXRmOCcpO1xyXG5cdFx0dmFsdWUuY29weShkYnVmLCBwb3MrMSk7XHJcblx0XHR2YXIgd3JpdHRlbj12YWx1ZS5sZW5ndGgrMTtcclxuXHRcdGlmIChwb3Mrd3JpdHRlbj5jdXIpIGN1cj1wb3Mrd3JpdHRlbjtcclxuXHRcdHJldHVybiB3cml0dGVuO1xyXG5cdH1cdFx0XHJcblx0Lyogbm8gc2lnbmF0dXJlICovXHJcblx0dmFyIHdyaXRlRml4ZWRBcnJheSA9IGZ1bmN0aW9uKHZhbHVlLHBvcyx1bml0c2l6ZSkge1xyXG5cdFx0Ly9jb25zb2xlLmxvZygndi5sZW4nLHZhbHVlLmxlbmd0aCxpdGVtcy5sZW5ndGgsdW5pdHNpemUpO1xyXG5cdFx0aWYgKHVuaXRzaXplPT09MSkgdmFyIGZ1bmM9ZGJ1Zi53cml0ZVVJbnQ4O1xyXG5cdFx0ZWxzZSBpZiAodW5pdHNpemU9PT00KXZhciBmdW5jPWRidWYud3JpdGVJbnQzMkJFO1xyXG5cdFx0ZWxzZSB0aHJvdyAndW5zdXBwb3J0ZWQgaW50ZWdlciBzaXplJztcclxuXHRcdGlmICghdmFsdWUubGVuZ3RoKSB7XHJcblx0XHRcdHRocm93IFwiZW1wdHkgZml4ZWQgYXJyYXkgXCIra2V5X3dyaXRpbmc7XHJcblx0XHR9XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aCA7IGkrKykge1xyXG5cdFx0XHRmdW5jLmFwcGx5KGRidWYsW3ZhbHVlW2ldLGkqdW5pdHNpemUrcG9zXSlcclxuXHRcdH1cclxuXHRcdHZhciBsZW49dW5pdHNpemUqdmFsdWUubGVuZ3RoO1xyXG5cdFx0aWYgKHBvcytsZW4+Y3VyKSBjdXI9cG9zK2xlbjtcclxuXHRcdHJldHVybiBsZW47XHJcblx0fVxyXG5cclxuXHR0aGlzLndyaXRlSTMyPXdyaXRlSTMyO1xyXG5cdHRoaXMud3JpdGVCb29sPXdyaXRlQm9vbDtcclxuXHR0aGlzLndyaXRlQmxvYj13cml0ZUJsb2I7XHJcblx0dGhpcy53cml0ZVVJOD13cml0ZVVJODtcclxuXHR0aGlzLndyaXRlU3RyaW5nPXdyaXRlU3RyaW5nO1xyXG5cdHRoaXMud3JpdGVTaWduYXR1cmU9d3JpdGVTaWduYXR1cmU7XHJcblx0dGhpcy53cml0ZU9mZnNldD13cml0ZU9mZnNldDsgLy81IGJ5dGVzIG9mZnNldFxyXG5cdHRoaXMud3JpdGVTdHJpbmdBcnJheT13cml0ZVN0cmluZ0FycmF5O1xyXG5cdHRoaXMud3JpdGVGaXhlZEFycmF5PXdyaXRlRml4ZWRBcnJheTtcclxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJidWZcIiwge2dldCA6IGZ1bmN0aW9uKCl7IHJldHVybiBkYnVmOyB9fSk7XHJcblx0XHJcblx0cmV0dXJuIHRoaXM7XHJcbn1cclxuXHJcbnZhciBDcmVhdGU9ZnVuY3Rpb24ocGF0aCxvcHRzKSB7XHJcblx0b3B0cz1vcHRzfHx7fTtcclxuXHR2YXIga2ZzPW5ldyBLZnMocGF0aCxvcHRzKTtcclxuXHR2YXIgY3VyPTA7XHJcblxyXG5cdHZhciBoYW5kbGU9e307XHJcblx0XHJcblx0Ly9ubyBzaWduYXR1cmVcclxuXHR2YXIgd3JpdGVWSW50ID1mdW5jdGlvbihhcnIpIHtcclxuXHRcdHZhciBvPXBhY2tfaW50KGFycixmYWxzZSk7XHJcblx0XHRrZnMud3JpdGVGaXhlZEFycmF5KG8sY3VyLDEpO1xyXG5cdFx0Y3VyKz1vLmxlbmd0aDtcclxuXHR9XHJcblx0dmFyIHdyaXRlVkludDE9ZnVuY3Rpb24odmFsdWUpIHtcclxuXHRcdHdyaXRlVkludChbdmFsdWVdKTtcclxuXHR9XHJcblx0Ly9mb3IgcG9zdGluZ3NcclxuXHR2YXIgd3JpdGVQSW50ID1mdW5jdGlvbihhcnIpIHtcclxuXHRcdHZhciBvPXBhY2tfaW50KGFycix0cnVlKTtcclxuXHRcdGtmcy53cml0ZUZpeGVkQXJyYXkobyxjdXIsMSk7XHJcblx0XHRjdXIrPW8ubGVuZ3RoO1xyXG5cdH1cclxuXHRcclxuXHR2YXIgc2F2ZVZJbnQgPSBmdW5jdGlvbihhcnIsa2V5KSB7XHJcblx0XHR2YXIgc3RhcnQ9Y3VyO1xyXG5cdFx0a2V5X3dyaXRpbmc9a2V5O1xyXG5cdFx0Y3VyKz1rZnMud3JpdGVTaWduYXR1cmUoRFQudmludCxjdXIpO1xyXG5cdFx0d3JpdGVWSW50KGFycik7XHJcblx0XHR2YXIgd3JpdHRlbiA9IGN1ci1zdGFydDtcclxuXHRcdHB1c2hpdGVtKGtleSx3cml0dGVuKTtcclxuXHRcdHJldHVybiB3cml0dGVuO1x0XHRcclxuXHR9XHJcblx0dmFyIHNhdmVQSW50ID0gZnVuY3Rpb24oYXJyLGtleSkge1xyXG5cdFx0dmFyIHN0YXJ0PWN1cjtcclxuXHRcdGtleV93cml0aW5nPWtleTtcclxuXHRcdGN1cis9a2ZzLndyaXRlU2lnbmF0dXJlKERULnBpbnQsY3VyKTtcclxuXHRcdHdyaXRlUEludChhcnIpO1xyXG5cdFx0dmFyIHdyaXR0ZW4gPSBjdXItc3RhcnQ7XHJcblx0XHRwdXNoaXRlbShrZXksd3JpdHRlbik7XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcdFxyXG5cdH1cclxuXHJcblx0XHJcblx0dmFyIHNhdmVVSTggPSBmdW5jdGlvbih2YWx1ZSxrZXkpIHtcclxuXHRcdHZhciB3cml0dGVuPWtmcy53cml0ZVVJOCh2YWx1ZSxjdXIpO1xyXG5cdFx0Y3VyKz13cml0dGVuO1xyXG5cdFx0cHVzaGl0ZW0oa2V5LHdyaXR0ZW4pO1xyXG5cdFx0cmV0dXJuIHdyaXR0ZW47XHJcblx0fVxyXG5cdHZhciBzYXZlQm9vbD1mdW5jdGlvbih2YWx1ZSxrZXkpIHtcclxuXHRcdHZhciB3cml0dGVuPWtmcy53cml0ZUJvb2wodmFsdWUsY3VyKTtcclxuXHRcdGN1cis9d3JpdHRlbjtcclxuXHRcdHB1c2hpdGVtKGtleSx3cml0dGVuKTtcclxuXHRcdHJldHVybiB3cml0dGVuO1xyXG5cdH1cclxuXHR2YXIgc2F2ZUkzMiA9IGZ1bmN0aW9uKHZhbHVlLGtleSkge1xyXG5cdFx0dmFyIHdyaXR0ZW49a2ZzLndyaXRlSTMyKHZhbHVlLGN1cik7XHJcblx0XHRjdXIrPXdyaXR0ZW47XHJcblx0XHRwdXNoaXRlbShrZXksd3JpdHRlbik7XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcclxuXHR9XHRcclxuXHR2YXIgc2F2ZVN0cmluZyA9IGZ1bmN0aW9uKHZhbHVlLGtleSxlbmNvZGluZykge1xyXG5cdFx0ZW5jb2Rpbmc9ZW5jb2Rpbmd8fHN0cmluZ2VuY29kaW5nO1xyXG5cdFx0a2V5X3dyaXRpbmc9a2V5O1xyXG5cdFx0dmFyIHdyaXR0ZW49a2ZzLndyaXRlU3RyaW5nKHZhbHVlLGN1cixlbmNvZGluZyk7XHJcblx0XHRjdXIrPXdyaXR0ZW47XHJcblx0XHRwdXNoaXRlbShrZXksd3JpdHRlbik7XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcclxuXHR9XHJcblx0dmFyIHNhdmVTdHJpbmdBcnJheSA9IGZ1bmN0aW9uKGFycixrZXksZW5jb2RpbmcpIHtcclxuXHRcdGVuY29kaW5nPWVuY29kaW5nfHxzdHJpbmdlbmNvZGluZztcclxuXHRcdGtleV93cml0aW5nPWtleTtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHZhciB3cml0dGVuPWtmcy53cml0ZVN0cmluZ0FycmF5KGFycixjdXIsZW5jb2RpbmcpO1xyXG5cdFx0fSBjYXRjaChlKSB7XHJcblx0XHRcdHRocm93IGU7XHJcblx0XHR9XHJcblx0XHRjdXIrPXdyaXR0ZW47XHJcblx0XHRwdXNoaXRlbShrZXksd3JpdHRlbik7XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcclxuXHR9XHJcblx0XHJcblx0dmFyIHNhdmVCbG9iID0gZnVuY3Rpb24odmFsdWUsa2V5KSB7XHJcblx0XHRrZXlfd3JpdGluZz1rZXk7XHJcblx0XHR2YXIgd3JpdHRlbj1rZnMud3JpdGVCbG9iKHZhbHVlLGN1cik7XHJcblx0XHRjdXIrPXdyaXR0ZW47XHJcblx0XHRwdXNoaXRlbShrZXksd3JpdHRlbik7XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcclxuXHR9XHJcblxyXG5cdHZhciBmb2xkZXJzPVtdO1xyXG5cdHZhciBwdXNoaXRlbT1mdW5jdGlvbihrZXksd3JpdHRlbikge1xyXG5cdFx0dmFyIGZvbGRlcj1mb2xkZXJzW2ZvbGRlcnMubGVuZ3RoLTFdO1x0XHJcblx0XHRpZiAoIWZvbGRlcikgcmV0dXJuIDtcclxuXHRcdGZvbGRlci5pdGVtc2xlbmd0aC5wdXNoKHdyaXR0ZW4pO1xyXG5cdFx0aWYgKGtleSkge1xyXG5cdFx0XHRpZiAoIWZvbGRlci5rZXlzKSB0aHJvdyAnY2Fubm90IGhhdmUga2V5IGluIGFycmF5JztcclxuXHRcdFx0Zm9sZGVyLmtleXMucHVzaChrZXkpO1xyXG5cdFx0fVxyXG5cdH1cdFxyXG5cdHZhciBvcGVuID0gZnVuY3Rpb24ob3B0KSB7XHJcblx0XHR2YXIgc3RhcnQ9Y3VyO1xyXG5cdFx0dmFyIGtleT1vcHQua2V5IHx8IG51bGw7XHJcblx0XHR2YXIgdHlwZT1vcHQudHlwZXx8RFQuYXJyYXk7XHJcblx0XHRjdXIrPWtmcy53cml0ZVNpZ25hdHVyZSh0eXBlLGN1cik7XHJcblx0XHRjdXIrPWtmcy53cml0ZU9mZnNldCgweDAsY3VyKTsgLy8gcHJlLWFsbG9jIHNwYWNlIGZvciBvZmZzZXRcclxuXHRcdHZhciBmb2xkZXI9e1xyXG5cdFx0XHR0eXBlOnR5cGUsIGtleTprZXksXHJcblx0XHRcdHN0YXJ0OnN0YXJ0LGRhdGFzdGFydDpjdXIsXHJcblx0XHRcdGl0ZW1zbGVuZ3RoOltdIH07XHJcblx0XHRpZiAodHlwZT09PURULm9iamVjdCkgZm9sZGVyLmtleXM9W107XHJcblx0XHRmb2xkZXJzLnB1c2goZm9sZGVyKTtcclxuXHR9XHJcblx0dmFyIG9wZW5PYmplY3QgPSBmdW5jdGlvbihrZXkpIHtcclxuXHRcdG9wZW4oe3R5cGU6RFQub2JqZWN0LGtleTprZXl9KTtcclxuXHR9XHJcblx0dmFyIG9wZW5BcnJheSA9IGZ1bmN0aW9uKGtleSkge1xyXG5cdFx0b3Blbih7dHlwZTpEVC5hcnJheSxrZXk6a2V5fSk7XHJcblx0fVxyXG5cdHZhciBzYXZlSW50cz1mdW5jdGlvbihhcnIsa2V5LGZ1bmMpIHtcclxuXHRcdGZ1bmMuYXBwbHkoaGFuZGxlLFthcnIsa2V5XSk7XHJcblx0fVxyXG5cdHZhciBjbG9zZSA9IGZ1bmN0aW9uKG9wdCkge1xyXG5cdFx0aWYgKCFmb2xkZXJzLmxlbmd0aCkgdGhyb3cgJ2VtcHR5IHN0YWNrJztcclxuXHRcdHZhciBmb2xkZXI9Zm9sZGVycy5wb3AoKTtcclxuXHRcdC8vanVtcCB0byBsZW5ndGhzIGFuZCBrZXlzXHJcblx0XHRrZnMud3JpdGVPZmZzZXQoIGN1ci1mb2xkZXIuZGF0YXN0YXJ0LCBmb2xkZXIuZGF0YXN0YXJ0LTUpO1xyXG5cdFx0dmFyIGl0ZW1jb3VudD1mb2xkZXIuaXRlbXNsZW5ndGgubGVuZ3RoO1xyXG5cdFx0Ly9zYXZlIGxlbmd0aHNcclxuXHRcdHdyaXRlVkludDEoaXRlbWNvdW50KTtcclxuXHRcdHdyaXRlVkludChmb2xkZXIuaXRlbXNsZW5ndGgpO1xyXG5cdFx0XHJcblx0XHRpZiAoZm9sZGVyLnR5cGU9PT1EVC5vYmplY3QpIHtcclxuXHRcdFx0Ly91c2UgdXRmOCBmb3Iga2V5c1xyXG5cdFx0XHRjdXIrPWtmcy53cml0ZVN0cmluZ0FycmF5KGZvbGRlci5rZXlzLGN1ciwndXRmOCcpO1xyXG5cdFx0fVxyXG5cdFx0d3JpdHRlbj1jdXItZm9sZGVyLnN0YXJ0O1xyXG5cdFx0cHVzaGl0ZW0oZm9sZGVyLmtleSx3cml0dGVuKTtcclxuXHRcdHJldHVybiB3cml0dGVuO1xyXG5cdH1cclxuXHRcclxuXHRcclxuXHR2YXIgc3RyaW5nZW5jb2Rpbmc9J3VjczInO1xyXG5cdHZhciBzdHJpbmdFbmNvZGluZz1mdW5jdGlvbihuZXdlbmNvZGluZykge1xyXG5cdFx0aWYgKG5ld2VuY29kaW5nKSBzdHJpbmdlbmNvZGluZz1uZXdlbmNvZGluZztcclxuXHRcdGVsc2UgcmV0dXJuIHN0cmluZ2VuY29kaW5nO1xyXG5cdH1cclxuXHRcclxuXHR2YXIgYWxsbnVtYmVyX2Zhc3Q9ZnVuY3Rpb24oYXJyKSB7XHJcblx0XHRpZiAoYXJyLmxlbmd0aDw1KSByZXR1cm4gYWxsbnVtYmVyKGFycik7XHJcblx0XHRpZiAodHlwZW9mIGFyclswXT09J251bWJlcidcclxuXHRcdCAgICAmJiBNYXRoLnJvdW5kKGFyclswXSk9PWFyclswXSAmJiBhcnJbMF0+PTApXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHR2YXIgYWxsc3RyaW5nX2Zhc3Q9ZnVuY3Rpb24oYXJyKSB7XHJcblx0XHRpZiAoYXJyLmxlbmd0aDw1KSByZXR1cm4gYWxsc3RyaW5nKGFycik7XHJcblx0XHRpZiAodHlwZW9mIGFyclswXT09J3N0cmluZycpIHJldHVybiB0cnVlO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cdFxyXG5cdHZhciBhbGxudW1iZXI9ZnVuY3Rpb24oYXJyKSB7XHJcblx0XHRmb3IgKHZhciBpPTA7aTxhcnIubGVuZ3RoO2krKykge1xyXG5cdFx0XHRpZiAodHlwZW9mIGFycltpXSE9PSdudW1iZXInKSByZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblx0dmFyIGFsbHN0cmluZz1mdW5jdGlvbihhcnIpIHtcclxuXHRcdGZvciAodmFyIGk9MDtpPGFyci5sZW5ndGg7aSsrKSB7XHJcblx0XHRcdGlmICh0eXBlb2YgYXJyW2ldIT09J3N0cmluZycpIHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHR2YXIgZ2V0RW5jb2Rpbmc9ZnVuY3Rpb24oa2V5LGVuY3MpIHtcclxuXHRcdHZhciBlbmM9ZW5jc1trZXldO1xyXG5cdFx0aWYgKCFlbmMpIHJldHVybiBudWxsO1xyXG5cdFx0aWYgKGVuYz09J2RlbHRhJyB8fCBlbmM9PSdwb3N0aW5nJykge1xyXG5cdFx0XHRyZXR1cm4gc2F2ZVBJbnQ7XHJcblx0XHR9IGVsc2UgaWYgKGVuYz09XCJ2YXJpYWJsZVwiKSB7XHJcblx0XHRcdHJldHVybiBzYXZlVkludDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHR2YXIgc2F2ZT1mdW5jdGlvbihKLGtleSxvcHRzKSB7XHJcblx0XHRvcHRzPW9wdHN8fHt9O1xyXG5cdFx0XHJcblx0XHRpZiAodHlwZW9mIEo9PVwibnVsbFwiIHx8IHR5cGVvZiBKPT1cInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdHRocm93ICdjYW5ub3Qgc2F2ZSBudWxsIHZhbHVlIG9mIFsnK2tleSsnXSBmb2xkZXJzJytKU09OLnN0cmluZ2lmeShmb2xkZXJzKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHR5cGU9Si5jb25zdHJ1Y3Rvci5uYW1lO1xyXG5cdFx0aWYgKHR5cGU9PT0nT2JqZWN0Jykge1xyXG5cdFx0XHRvcGVuT2JqZWN0KGtleSk7XHJcblx0XHRcdGZvciAodmFyIGkgaW4gSikge1xyXG5cdFx0XHRcdHNhdmUoSltpXSxpLG9wdHMpO1xyXG5cdFx0XHRcdGlmIChvcHRzLmF1dG9kZWxldGUpIGRlbGV0ZSBKW2ldO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNsb3NlKCk7XHJcblx0XHR9IGVsc2UgaWYgKHR5cGU9PT0nQXJyYXknKSB7XHJcblx0XHRcdGlmIChhbGxudW1iZXJfZmFzdChKKSkge1xyXG5cdFx0XHRcdGlmIChKLnNvcnRlZCkgeyAvL251bWJlciBhcnJheSBpcyBzb3J0ZWRcclxuXHRcdFx0XHRcdHNhdmVJbnRzKEosa2V5LHNhdmVQSW50KTtcdC8vcG9zdGluZyBkZWx0YSBmb3JtYXRcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0c2F2ZUludHMoSixrZXksc2F2ZVZJbnQpO1x0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2UgaWYgKGFsbHN0cmluZ19mYXN0KEopKSB7XHJcblx0XHRcdFx0c2F2ZVN0cmluZ0FycmF5KEosa2V5KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRvcGVuQXJyYXkoa2V5KTtcclxuXHRcdFx0XHRmb3IgKHZhciBpPTA7aTxKLmxlbmd0aDtpKyspIHtcclxuXHRcdFx0XHRcdHNhdmUoSltpXSxudWxsLG9wdHMpO1xyXG5cdFx0XHRcdFx0aWYgKG9wdHMuYXV0b2RlbGV0ZSkgZGVsZXRlIEpbaV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNsb3NlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAodHlwZT09PSdTdHJpbmcnKSB7XHJcblx0XHRcdHNhdmVTdHJpbmcoSixrZXkpO1xyXG5cdFx0fSBlbHNlIGlmICh0eXBlPT09J051bWJlcicpIHtcclxuXHRcdFx0aWYgKEo+PTAmJko8MjU2KSBzYXZlVUk4KEosa2V5KTtcclxuXHRcdFx0ZWxzZSBzYXZlSTMyKEosa2V5KTtcclxuXHRcdH0gZWxzZSBpZiAodHlwZT09PSdCb29sZWFuJykge1xyXG5cdFx0XHRzYXZlQm9vbChKLGtleSk7XHJcblx0XHR9IGVsc2UgaWYgKHR5cGU9PT0nQnVmZmVyJykge1xyXG5cdFx0XHRzYXZlQmxvYihKLGtleSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aHJvdyAndW5zdXBwb3J0ZWQgdHlwZSAnK3R5cGU7XHJcblx0XHR9XHJcblx0fVxyXG5cdFxyXG5cdHZhciBmcmVlPWZ1bmN0aW9uKCkge1xyXG5cdFx0d2hpbGUgKGZvbGRlcnMubGVuZ3RoKSBjbG9zZSgpO1xyXG5cdFx0a2ZzLmZyZWUoKTtcclxuXHR9XHJcblx0dmFyIGN1cnJlbnRzaXplPWZ1bmN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIGN1cjtcclxuXHR9XHJcblxyXG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShoYW5kbGUsIFwic2l6ZVwiLCB7Z2V0IDogZnVuY3Rpb24oKXsgcmV0dXJuIGN1cjsgfX0pO1xyXG5cclxuXHR2YXIgd3JpdGVGaWxlPWZ1bmN0aW9uKGZuLG9wdHMsY2IpIHtcclxuXHRcdGlmICh0eXBlb2YgZnM9PVwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0dmFyIGZzPW9wdHMuZnN8fHJlcXVpcmUoJ2ZzJyk7XHRcclxuXHRcdH1cclxuXHRcdHZhciB0b3RhbGJ5dGU9aGFuZGxlLmN1cnJlbnRzaXplKCk7XHJcblx0XHR2YXIgd3JpdHRlbj0wLGJhdGNoPTA7XHJcblx0XHRcclxuXHRcdGlmICh0eXBlb2YgY2I9PVwidW5kZWZpbmVkXCIgfHwgdHlwZW9mIG9wdHM9PVwiZnVuY3Rpb25cIikge1xyXG5cdFx0XHRjYj1vcHRzO1xyXG5cdFx0fVxyXG5cdFx0b3B0cz1vcHRzfHx7fTtcclxuXHRcdGJhdGNoc2l6ZT1vcHRzLmJhdGNoc2l6ZXx8MTAyNCoxMDI0KjE2OyAvLzE2IE1CXHJcblxyXG5cdFx0aWYgKGZzLmV4aXN0c1N5bmMoZm4pKSBmcy51bmxpbmtTeW5jKGZuKTtcclxuXHJcblx0XHR2YXIgd3JpdGVDYj1mdW5jdGlvbih0b3RhbCx3cml0dGVuLGNiLG5leHQpIHtcclxuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKGVycikge1xyXG5cdFx0XHRcdGlmIChlcnIpIHRocm93IFwid3JpdGUgZXJyb3JcIitlcnI7XHJcblx0XHRcdFx0Y2IodG90YWwsd3JpdHRlbik7XHJcblx0XHRcdFx0YmF0Y2grKztcclxuXHRcdFx0XHRuZXh0KCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbmV4dD1mdW5jdGlvbigpIHtcclxuXHRcdFx0aWYgKGJhdGNoPGJhdGNoZXMpIHtcclxuXHRcdFx0XHR2YXIgYnVmc3RhcnQ9YmF0Y2hzaXplKmJhdGNoO1xyXG5cdFx0XHRcdHZhciBidWZlbmQ9YnVmc3RhcnQrYmF0Y2hzaXplO1xyXG5cdFx0XHRcdGlmIChidWZlbmQ+dG90YWxieXRlKSBidWZlbmQ9dG90YWxieXRlO1xyXG5cdFx0XHRcdHZhciBzbGljZWQ9a2ZzLmJ1Zi5zbGljZShidWZzdGFydCxidWZlbmQpO1xyXG5cdFx0XHRcdHdyaXR0ZW4rPXNsaWNlZC5sZW5ndGg7XHJcblx0XHRcdFx0ZnMuYXBwZW5kRmlsZShmbixzbGljZWQsd3JpdGVDYih0b3RhbGJ5dGUsd3JpdHRlbiwgY2IsbmV4dCkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHR2YXIgYmF0Y2hlcz0xK01hdGguZmxvb3IoaGFuZGxlLnNpemUvYmF0Y2hzaXplKTtcclxuXHRcdG5leHQoKTtcclxuXHR9XHJcblx0aGFuZGxlLmZyZWU9ZnJlZTtcclxuXHRoYW5kbGUuc2F2ZUkzMj1zYXZlSTMyO1xyXG5cdGhhbmRsZS5zYXZlVUk4PXNhdmVVSTg7XHJcblx0aGFuZGxlLnNhdmVCb29sPXNhdmVCb29sO1xyXG5cdGhhbmRsZS5zYXZlU3RyaW5nPXNhdmVTdHJpbmc7XHJcblx0aGFuZGxlLnNhdmVWSW50PXNhdmVWSW50O1xyXG5cdGhhbmRsZS5zYXZlUEludD1zYXZlUEludDtcclxuXHRoYW5kbGUuc2F2ZUludHM9c2F2ZUludHM7XHJcblx0aGFuZGxlLnNhdmVCbG9iPXNhdmVCbG9iO1xyXG5cdGhhbmRsZS5zYXZlPXNhdmU7XHJcblx0aGFuZGxlLm9wZW5BcnJheT1vcGVuQXJyYXk7XHJcblx0aGFuZGxlLm9wZW5PYmplY3Q9b3Blbk9iamVjdDtcclxuXHRoYW5kbGUuc3RyaW5nRW5jb2Rpbmc9c3RyaW5nRW5jb2Rpbmc7XHJcblx0Ly90aGlzLmludGVnZXJFbmNvZGluZz1pbnRlZ2VyRW5jb2Rpbmc7XHJcblx0aGFuZGxlLmNsb3NlPWNsb3NlO1xyXG5cdGhhbmRsZS53cml0ZUZpbGU9d3JpdGVGaWxlO1xyXG5cdGhhbmRsZS5jdXJyZW50c2l6ZT1jdXJyZW50c2l6ZTtcclxuXHRyZXR1cm4gaGFuZGxlO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cz1DcmVhdGU7Il19
