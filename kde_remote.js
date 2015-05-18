var pool={};
var strsep="\uffff";
var method=require("./method");

var getRemote=function(path,opts,cb) {

	if (typeof opts==="function") {
		opts={};
		cb=opts;
	}

	opts=opts||{};
	
	var $kde=require("./rpc_kde");

	var engine=this;
	var kdbid=engine.kdb;
	kdbid=kdbid.substr(window.location.origin.length+1).replace(".kdb","");

	if (typeof opts=="function") {
		cb=opts;
		opts={recursive:false};
	}
	opts.recursive=opts.recursive||false;
	if (typeof path=="string") path=[path];

	if (path[0] instanceof Array) { //multiple paths
		var paths=[],output=[];
		for (var i=0;i<path.length;i++) {
			var cachepath=path[i].join(strsep);
			var data=engine.cache[cachepath];
			if (typeof data!="undefined") {
				paths.push(null);//  place holder for LINE 28
				output.push(data); //put cached data into output
			} else{
				engine.fetched++;
				paths.push(path[i]); //need to ask server
				output.push(null); //data is unknown yet
			}
		}
		//now ask server for unknown datum
		engine.traffic++;
		var newopts={recursive:!!opts.recursive, address:opts.address,
			key:paths,db:kdbid};
		$kde.get(newopts,function(datum){
			//merge the server result with cached 
			for (var i=0;i<output.length;i++) {
				if (datum[i] && paths[i]) {
					var cachekey=paths[i].join(strsep);
					engine.cache[cachepath]=datum[i];
					output[i]=datum[i];
				}
			}
			cb.apply(engine.context,[output]);	
		});
	} else { //single path
		var cachepath=path.join(strsep);
		var data=engine.cache[cachepath];
		if (typeof data!="undefined") {
			if (cb) cb.apply(engine.context,[data]);
			return data;//in cache , return immediately
		} else {
			engine.traffic++;
			engine.fetched++;
			var opts={key:path,recursive:!!opts.recursive,db:kdbid};
			$kde.get(opts,function(data){
				engine.cache[cachepath]=data;
				if (cb) cb.apply(engine.context,[data]);	
			});
		}
	}
}

var createRemoteEngine=function(kdb,opts,cb,context) {

	var engine={kdb:kdb, queryCache:{}, postingCache:{}, cache:{}};
	if (typeof context=="object") engine.context=context;
	method.setup(engine);
	engine.get=getRemote;

	var setPreload=function(res) {
		engine.dbname=res[0].name;
		//engine.customfunc=customfunc.getAPI(res[0].config);
		engine.ready=true;
	}
	var preload=method.getPreloadField(opts.preload);
	var opts={recursive:true};
	method.gets.apply(engine,[ preload, opts,function(res){
		setPreload(res);
		cb.apply(engine.context,[engine]);
	}]);
	return engine;
}

var openRemote=function(kdbid,opts,cb,context) {
	if (typeof opts=="function") {
		cb=opts;
		context=cb;
		opts={};
	}

	var engine=pool[kdbid];
	if (engine) {
		if (cb) cb.apply(context||engine.context,[0,engine]);
		return engine;
	}

	createRemoteEngine(kdbid,opts,function(engine){
		pool[kdbid]=engine;
		cb.apply(context||engine.context,[0,engine]);
	},context);

	pool[kdbid]=engine;
}

var close=function(kdbid) {
	var engine=pool[kdbid];
	if (engine) {
		delete pool[kdbid];
	}
}

module.exports=openRemote;