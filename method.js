var bsearch=require("./bsearch");
var verbose=false;
var gets=function(paths,opts,cb) { //get many data with one call

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


var localengine_get=function(path,opts,cb,context) {
	var engine=this;

	if (typeof opts=="function") {
		context=cb;
		cb=opts;
		opts={recursive:false};
	}
	if (!path) {
		if (cb) cb.apply(context,[null]);
		return null;
	}

	if (typeof cb!="function") {
		return engine.kdb.get(path,opts);
	}

/*
	if (engine.busy) {
		console.log("engine is busy, getting "+JSON.stringify(this.busy)+" current path"+JSON.stringify(path));
		cb(null);
	}
*/
	if (typeof path==="string") {
		path=[path];
	}

	if (typeof path[0] =="string") {
		//engine.busy=path;
		return engine.kdb.get(path,opts,function(data){
			//engine.busy=null;
			cb.call(context,data);//return top level keys
		},context);
	} else if (typeof path[0] =="object") {
		return gets.call(engine,path,opts,function(data){
			cb.call(context,data);//return top level keys
		},context);
	} else {
		//engine.busy=path;
		engine.kdb.get([],opts,function(data){
			//engine.busy=null;
			cb.call(context,data);//return top level keys
		},context);
	}
};	
var getFileRange=function(i) {
	var engine=this;

	var filesegcount=engine.get(["filesegcount"]);

	if (filesegcount) {
		if (i==0) {
			return {start:0,end:filesegcount[0]-1};
		} else {
			return {start:filesegcount[i-1],end:filesegcount[i]-1};
		}
	}
	//old buggy code
	var filenames=engine.get(["filenames"]);
	var fileoffsets=engine.get(["fileoffsets"]);
	var segoffsets=engine.get(["segoffsets"]);
	var segnames=engine.get(["segnames"]);
	var filestart=fileoffsets[i], fileend=fileoffsets[i+1]-1;

	var start=bsearch(segoffsets,filestart,true);
	//if (segOffsets[start]==fileStart) start--;
	
	//work around for jiangkangyur
	//while (segNames[start+1]=="_") start++;

  //if (i==0) start=0; //work around for first file
	var end=bsearch(segoffsets,fileend,true);
	return {start:start,end:end};
}

var absSegToFileSeg=function(absoluteseg) {
	var filesegcount=this.get("filesegcount");
	var s=absoluteseg;
	var file=0;
	while (s>=filesegcount[file]) {
		file++;
	}
	if (file) {
		s=Math.abs(filesegcount[file-1]-s);	
	} else {
		s=absoluteseg;
	}
	
	return {file:file,seg:s};
}

var fileSegToAbsSeg=function(file,seg) {
	if (file==0)return seg;
	return this.get("filesegcount")[file-1]+(seg);
}

//var vposToFileSeg=function(engine,vpos) {
//    var segoffsets=engine.get("segoffsets");
//    var fileoffsets=engine.get(["fileoffsets"]);
//    var segnames=engine.get("segnames");
//    var fileid=bsearch(fileoffsets,vpos+1,true);
//    fileid--;
//    var segid=bsearch(segoffsets,vpos+1,true);
//	var range=engine.getFileRange(fileid);
//	segid-=range.start;
//    return {file:fileid,seg:segid};
//}
var searchSeg=function(segname,near) {
	var i=bsearch(this.get("segnames"),segname,near);
	if (i>-1) {
		var fileseg=absSegToFileSeg.apply(this,[i]);
		return {file:fileseg.file,seg:fileseg.seg,absseg:i};
	}
	return null;
}

//return array of object of nfile nseg given segname
var findSeg=function(segname,max) {
	meta=this.get("meta");
	if (meta.sortedSegNames) {
		return findSeg_sorted(segname);
	}
	var segnames=this.get("segnames");
	var out=[];
	for (var i=0;i<segnames.length;i++) {
		if (segnames[i]==segname) {
			var fileseg=absSegToFileSeg.apply(this,[i]);
			out.push({file:fileseg.file,seg:fileseg.seg,absseg:i});
			if (out.length>=max) break;
		}
	}
	return out;
}
var findFile=function(filename) {
	var filenames=this.get("filenames");
	for (var i=0;i<filenames.length;i++) {
		if (filenames[i]===filename) return i;
	}
	return -1;
}

var getFileSegOffsets=function(i) {
	var segoffsets=this.get("segoffsets");
	var range=getFileRange.apply(this,[i]);
	return segoffsets.slice(range.start,range.end+1);	
}
var absSegFromVpos=function(vpos) { 
	var segoffsets=this.get(["segoffsets"]);
	var i=bsearch(segoffsets,vpos,true);
	if (segoffsets[i]>vpos && segoffsets[i-1]<vpos) {
		return i-1;
	}
	return i;
}

var fileSegFromVpos=function(vpos) { 
	var seg=absSegFromVpos.call(this,vpos);
	return absSegToFileSeg.call(this,seg);
}
var fileSegToVpos=function(f,s) {
	var segoffsets=this.get(["segoffsets"]);
	var seg=fileSegToAbsSeg.call(this,f,s);
	return segoffsets[seg-1]||0;
}
var absSegToVpos=function(seg) {
	var segoffsets=this.get("segoffsets");
	return segoffsets[seg]||0;	
}
var getFileSegNames=function(i) {
	var range=getFileRange.apply(this,[i]);
	var segnames=this.get("segnames");
	return segnames.slice(range.start,range.end+1);
}

var getPreloadField=function(user) {
	var preload=[["meta"],["filenames"],["fileoffsets"],["segnames"],
	["segoffsets"],["filesegcount"]];

	//,["txtid"],["txtid_idx"],["txtid_invert"]];
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


var segOffset=function(segname) {
	var engine=this;
	if (arguments.length>1) throw "argument : segname ";

	var segNames=engine.get("segnames");
	var segOffsets=engine.get("segoffsets");

	var i=segNames.indexOf(segname);
	return (i>-1)?segOffsets[i]:0;
}
var fileOffset=function(fn) {
	var engine=this;
	var filenames=engine.get("filenames");
	var offsets=engine.get("fileoffsets");
	var i=filenames.indexOf(fn);
	if (i==-1) return null;
	return {start: offsets[i], end:offsets[i+1]};
}

var folderOffset=function(folder) {
	var engine=this;
	var start=0,end=0;
	var filenames=engine.get("filenames");
	var offsets=engine.get("fileoffsets");
	for (var i=0;i<filenames.length;i++) {
		if (filenames[i].substring(0,folder.length)==folder) {
			if (!start) start=offsets[i];
			end=offsets[i];
		} else if (start) break;
	}
	return {start:start,end:end};
}
var getTOCNames=function() {
	return engine.get("meta").tocs;
}
var buildToc = function(toc) {
	if (!toc || !toc.length || toc.built) return;
	var depths=[];
 	var prev=0;
 	if (toc.length>1) {
 		toc[0].o=true;//opened
 	}
 	for (var i=0;i<toc.length;i++) delete toc[i].n;
	for (var i=0;i<toc.length;i++) {
	    var depth=toc[i].d||toc[i].depth;
	    if (prev>depth) { //link to prev sibling
	      if (depths[depth]) toc[depths[depth]].n = i;
	      for (var j=depth;j<prev;j++) depths[j]=0;
	    }
    	depths[depth]=i;
    	prev=depth;
	}
	toc.built=true;
	return toc;
}
var getDefaultTOC=function(opts,cb,context) {
	var toc=this.TOC["_"];
	if (toc) {
		cb.call(context,toc);
		return toc;
	}

	var out=[{t:"root",d:0,vpos:1}];
	var fileoffsets=this.get("fileoffsets");
	var segoffsets=this.get("segoffsets");
	var segnames=this.get("segnames");
	var filenames=this.get("filenames");
	var depth=1;
	//TODO , convert file folder structure to depth
	for (var i=0;i<filenames.length;i++){
		var fn=filenames[i];
		fn=fn.substr(0,fn.lastIndexOf("."));
		out.push({t:fn,d:depth, vpos:fileoffsets[i]});
		var range=getFileRange.apply(this,[i]);
		for (var j=range.start;j<range.end+1;j++) {
			out.push({t:segnames[j],d:depth+1, vpos:segoffsets[j]||1});
		}
	}
	this.TOC["_"]=out;
  cb.call(context,out);
	return out;		
}
var getTOC=function(opts,cb,context) {
	var engine=this;
	opts=opts||{};
	var tocname=opts.tocname;
	var rootname=opts.rootname||opts.tocname;
	if (!tocname) return getDefaultTOC.call(this,opts,cb,context);

	var toc=engine.TOC[tocname];
	if (toc) {
		cb.call(context,toc);
		return toc;
	}

	var keys=[["fields",tocname],["fields",tocname+"_depth"],["fields",tocname+"_vpos"]];
	engine.get(keys,{recursive:true},function(){
	  var texts=engine.get(["fields",tocname]);
	  var depths=engine.get(["fields",tocname+"_depth"]);
	  var vpos=engine.get(["fields",tocname+"_vpos"]);

	  var out=[{d:0,t:rootname}];
	  if (texts) for (var i=0;i<texts.length;i++) {
	    out.push({t:texts[i],d:depths[i], vpos:vpos[i]});
	  }

	  engine.TOC[tocname]=out;
	  out=buildToc(out);
	  cb.call(context,out);
	  return out; 		
	});
}

var nextSeg=function(segid) {
	var segnames=this.get(["segnames"]);
	var i=segnames.indexOf(segid);
	if (i>-1 && i<segnames.length) {
		return segnames[i+1];
	} else return segid;
}
var prevSeg=function(segid) {
	var segnames=this.get(["segnames"]);
	var i=segnames.indexOf(segid);
	if (i>0) {
		return segnames[i-1];
	} else return segid;
}
//return file seg of first txtid

var txt2absseg=function(txtid) {
	var absseg=this.txtid[txtid];
	if (isNaN(absseg)) return null;
	if (typeof absseg[0]==="number") absseg=absseg[0];
	return absseg;
}
var txtid2fileSeg=function(txtid) {
	var absseg=txt2absseg.call(this,txtid);
	if (isNaN(absseg)) return;
	return absSegToFileSeg.call(this,absseg);
}

var vpos2txtid=function(vpos){
	var absseg=this.absSegFromVpos(vpos);
	var segnames=this.get("segnames");
	return segnames[absseg];
}

var nextTxtid=function(txtid) {
	var absseg=txt2absseg.call(this,txtid);
	if (isNaN(absseg)) return;
	var segnames=this.get("segnames");
	return segnames[absseg+1];
}
var prevTxtid=function(txtid) {
	var absseg=txt2absseg.call(this,txtid);
	if (isNaN(absseg)) return;
	var segnames=this.get("segnames");
	return segnames[absseg-1];
}
var txtid2vpos=function(txtid) {
	var absseg=txt2absseg.call(this,txtid);
	if (isNaN(absseg)) return;
	var segoffsets=this.get("segoffsets");
	return segoffsets[absseg];

}
var setup=function(engine) {
	engine.get=localengine_get;
	engine.segOffset=segOffset;
	engine.fileOffset=fileOffset;
	engine.folderOffset=folderOffset;
	engine.getFileSegNames=getFileSegNames;
	engine.getFileSegOffsets=getFileSegOffsets;
	engine.getFileRange=getFileRange;
	engine.findSeg=findSeg;
	engine.searchSeg=searchSeg;
	engine.findFile=findFile;
	engine.absSegToFileSeg=absSegToFileSeg;
	engine.fileSegToAbsSeg=fileSegToAbsSeg;
	engine.fileSegFromVpos=fileSegFromVpos;
	engine.absSegFromVpos=absSegFromVpos;
	engine.absSegToVpos=absSegToVpos;
	engine.fileSegToVpos=fileSegToVpos;
	engine.getTOC=getTOC;
	engine.getTOCNames=getTOCNames;
	engine.nextSeg=nextSeg;
	engine.prevSeg=prevSeg;
	engine.txtid2vpos=txtid2vpos;
	engine.vpos2txtid=vpos2txtid;
	engine.txtid2fileSeg=txtid2fileSeg;
	engine.nextTxtid=nextTxtid;
	engine.prevTxtid=prevTxtid;	
}
var hotfix_segoffset_before20150710=function(engine) {
	var so=engine.get("segoffsets");
	if (!so) so=engine.get("segOffsets");
	if (!so) return;
	if (so.length>2 && so[so.length-1]===so[so.length-2]) {
		so.unshift(1);
		so.pop();
		console.log("old segoffsets, better rebuild your kdb")
	}
}
var buildSegnameIndex=function(engine){
	/* replace txtid,txtid_idx, txtid_invert , save 400ms load time */
	var segnames=engine.get("segnames");
	if (!segnames) {
		console.log("missing segnames, cannot build uti");
		return;
	}
	var segindex={};
	if (verbose) console.time("build segname index");
	for (var i=0;i<segnames.length;i++) {
		var segname=segnames[i];
		segindex[segname]=i;
	}
	if (verbose) console.timeEnd("build segname index");
	engine.txtid=segindex;
}
module.exports={setup:setup,getPreloadField:getPreloadField,gets:gets
	,hotfix_segoffset_before20150710:hotfix_segoffset_before20150710
	,buildSegnameIndex:buildSegnameIndex};