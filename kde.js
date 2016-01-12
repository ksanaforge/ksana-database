// Ksana Database Engine

//   2015/1/2 , 
//   move to ksana-database
//   simplified by removing document support and socket.io support
//   2015/5/18 , add RPC support, move common method to method.js

var localPool={};
var apppath="";
var bsearch=require("./bsearch");
var Kdb=require('ksana-jsonrom');
var kdbs=[]; //available kdb , id and absolute path
var strsep="\uffff";
var kdblisted=false;

var method=require("./method");
var analyzer=require("ksana-analyzer");

var opening="";
var createLocalEngine=function(kdb,opts,cb,context) {

	var engine={kdb:kdb, queryCache:{}, postingCache:{}, cache:{}, TOC:{} , timing:{}};
	if (typeof context=="object") engine.context=context;
	method.setup(engine);
	//speedy native functions
	if (kdb.fs.mergePostings) {
		engine.mergePostings=kdb.fs.mergePostings.bind(kdb.fs);
	}
	var setPreload=function(res) {
		engine.dbname=res[0].name;
		//engine.customfunc=customfunc.getAPI(res[0].config);
		engine.ready=true;
		method.hotfix_segoffset_before20150710(engine);
		method.buildSegnameIndex(engine);


		var config=engine.get("meta").config;
		engine.sidsep=engine.get("meta").sidsep||"@";
		if (config) engine.analyzer=analyzer.getAPI(config);			
	}

	var t=new Date();
	var preload=method.getPreloadField(opts.preload);
	var opts={recursive:true};

	method.gets.apply(engine,[ preload, opts,function(res){
		setPreload(res);
		engine.timing.preload=new Date()-t;
		cb.apply(engine.context,[engine]);
	}]);
	return engine;
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


var getLocalTries=function(kdbfn,cb) {
	kdbid=kdbfn.replace('.kdb','');
	var tries= ["./"+kdbid+".kdb"
	           ,"../"+kdbid+".kdb"
	];

	for (var i=0;i<kdbs.length;i++) {
		if (kdbs[i][0]==kdbid) {
			tries.push(kdbs[i][1]);
		}
	}
	return tries;;
}

var opening="";
var openLocalReactNative=function(kdbid,opts,cb,context) {
	if (kdbid.indexOf(".kdb")==-1) kdbid+=".kdb";

	var engine=localPool[kdbid];
	if (engine) {
		cb.apply(context||engine.context,[0,engine]);
		return;
	}

	if (kdbid==opening) {
		throw "nested open kdb!! "+kdbid;
	}
	opening=kdbid;
	new Kdb.open(kdbid,function(err,kdb){
		if (err) {
			cb.apply(context,[err]);
		} else {
			createLocalEngine(kdb,opts,function(engine){
				localPool[kdbid]=engine;
				opening='';
				cb.apply(context||engine.context,[0,engine]);
			},context);
		}
	});
}


var openLocalKsanagap=function(kdbid,opts,cb,context) {
	var kdbfn=kdbid;


	var engine=localPool[kdbid];
	if (engine) {
		cb.apply(context||engine.context,[0,engine]);
		return;
	}
	var tries=getLocalTries(kdbfn);

	for (var i=0;i<tries.length;i++) {
		if (fs.existsSync(tries[i])) {
			//console.log("kdb path: "+nodeRequire('path').resolve(tries[i]));
			var kdb=new Kdb.open(tries[i],function(err,kdb){
				if (err) {
					cb.apply(context,[err]);
				} else {
					createLocalEngine(kdb,opts,function(engine){
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
		cb.apply(context||engine.context,[0,engine]);
		return;
	}

	if (kdbid==opening) {
		throw "nested open kdb!! "+kdbid;
	}
	opening=kdbid;

	var tries=getLocalTries(kdbid);
	for (var i=0;i<tries.length;i++) {
		if (fs.existsSync(tries[i])) {

			new Kdb.open(tries[i],function(err,kdb){
				if (err) {
					cb.apply(context||engine.content,[err]);
				} else {
					createLocalEngine(kdb,opts,function(engine){
						localPool[kdbid]=engine;
						opening="";
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
var openLocalFile=function(file,opts,cb,context) {	
    var kdbid=file.name.substr(0,file.name.length-4);

		if (kdbid==opening) {
			throw "nested open kdb!! "+kdbid;
		}
		opening=kdbid;

		var engine=localPool[kdbid];
		if (engine) {
			cb.apply(context||engine.context,[0,engine]);
			return;
		}

		new Kdb.open(file,function(err,handle){
			createLocalEngine(handle,opts,function(engine){
				localPool[kdbid]=engine;
				opening="";
				cb.apply(context||engine.context,[0,engine]);
			},context);
		});
}

var openLocalHtml5=function(kdbid,opts,cb,context) {	
	var engine=localPool[kdbid];
	var kdbfn=kdbid;
	if (kdbfn.indexOf(".kdb")==-1) kdbfn+=".kdb";

	if (kdbid==opening) {
		throw "nested open kdb!! "+kdbid;
	}
	opening=kdbid;

	new Kdb.open(kdbfn,function(err,handle){
		if (err) {
			var remoteurl=window.location.origin+window.location.pathname+kdbid;
			if (kdbid.indexOf("/")>-1) remoteurl=window.location.origin+'/'+kdbid;
			return kde_remote(remoteurl,opts,cb,context);
			//cb.apply(context,[err]);
		} else {
			createLocalEngine(handle,opts,function(engine){
				localPool[kdbid]=engine;
				opening="";
				cb.apply(context||engine.context,[0,engine]);
			},context);
		}
	});
}

var kde_remote=require("./kde_remote");
//omit cb for syncronize open
var open=function(kdbid,opts,cb,context)  {
	if (typeof opts=="function") { //no opts
		if (typeof cb=="object") context=cb;
		cb=opts;
		opts={};
	}

	if (typeof File!=="undefined" && kdbid.constructor===File) {
		return openLocalFile(kdbid,opts,cb,context);
	}

	if (kdbid.indexOf("http")==0) {
		return kde_remote(kdbid,opts,cb,context);
	}
	
	var engine=localPool[kdbid];
	if (engine) {
		if (cb) cb.apply(context||engine.context,[0,engine]);
		return engine;
	}

	var platform=require("./platform").getPlatform();
	if (platform=="node-webkit" || platform=="node") {
		openLocalNode(kdbid,opts,cb,context);
	} else if (platform=="html5" || platform=="chrome"){
		openLocalHtml5(kdbid,opts,cb,context);		
	} else if (platform.substr(0,12)=="react-native") {
		openLocalReactNative(kdbid,opts,cb,context);	
	} else {
		openLocalKsanagap(kdbid,opts,cb,context);	
	}
}
var setPath=function(path) {
	apppath=path;
	console.log("set path",path)
}
//return kdb names in array of string
var enumKdb=function(cb,context){
	require("./listkdb")(function(files){
		kdbs=files;
		if (cb) cb.call(context, kdbs.map(function(k){return k[0]}) );
	});
}

//return object for each kdb
var listkdb=function(cb,context){
	if (API.rpc) {
		API.rpc.list({},function(databases){
			cb.call(context,databases);
		});
	} else {
		require("./listkdb")(function(files){
			var databases=files.map(function(k){
				var relpath=k[1].match( /([^\/]+?\/[^\/]+?)\.kdb/)[1];
				return {shortname:k[0],folder:relpath.split("/")[0],fullname:relpath};
			});
			cb.call(context,databases);
		});
	}
}

var API={open:open,setPath:setPath, close:closeLocal, enumKdb:enumKdb, bsearch:bsearch,
kdbs:kdbs,listkdb:listkdb};

var platform=require("./platform").getPlatform();
if (platform=="node-webkit" || platform=="node" || platform.substr(0,12)=="react-native") {
	enumKdb();
} else if (typeof io!=="undefined") {
	API.rpc=require("./rpc_kde"); //for browser only
}
module.exports=API;