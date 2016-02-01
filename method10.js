/* old method for kdb has segnames but not segments */
var verbose=false;
var txt2absseg=function(txtid) {
	var absseg=this.txtid[txtid];
	if (isNaN(absseg)) return null;
	if (typeof absseg[0]==="number") absseg=absseg[0];
	return absseg;
}

var vpos2uti=function(vpos,cb){
	var segnames=this.get("segnames"),r;
	if (vpos instanceof Array) {
		r=	vpos.map(function(vp){
				return segnames[this.absSegFromVpos(vp)];
			}.bind(this))
	} else {
		var absseg=this.absSegFromVpos(vpos);
		r=segnames[absseg];
	}
	if (cb) cb(r);
	else return r;
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
	var filenames=engine.get(["filenames"]);
	var fileoffsets=engine.get(["fileoffsets"]);
	var segoffsets=engine.get(["segoffsets"]);
	var filestart=fileoffsets[i], fileend=fileoffsets[i+1]-1;

	var start=bsearch(segoffsets,filestart,true);
	var end=bsearch(segoffsets,fileend,true);
	return {start:start,end:end};
}

var getFileSegNames=function(i) {
	var range=getFileRange.apply(this,[i]);
	var segnames=this.get("segnames");
	return segnames.slice(range.start,range.end+1);
}


var uti2absseg=function(uti) {
	var absseg=this.txtid[uti];
	if (isNaN(absseg)) return null;
	if (typeof absseg[0]==="number") absseg=absseg[0];
	return absseg;
}
var uti2fileSeg=function(uti) {
	var absseg=uti2absseg.call(this,uti);
	if (isNaN(absseg)) return;
	return absSegToFileSeg.call(this,absseg);
}

var uti2vpos=function(uti,cb){
	var segoffsets=this.get("segoffsets");
	var r;
	if (uti instanceof Array) {
		r=uti.map(function(u){
				var absseg=txt2absseg.call(this,u);
				return segoffsets[absseg];
			}.bind(this))
	} else {
		var absseg=txt2absseg.call(this,uti);
		r=segoffsets[absseg];
	}

	if (cb) cb(r);
	else return r;	
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
var setup=function(engine) {
	engine.vpos2uti=vpos2uti;
	engine.uti2vpos=uti2vpos;
	engine.uti2fileSeg=uti2fileSeg;
	engine.getFileSegNames=getFileSegNames;
	engine.nextTxtid=nextTxtid;
	engine.prevTxtid=prevTxtid;
	buildSegnameIndex(engine);
}
module.exports={setup:setup,buildSegnameIndex};