try {
	var listkdb=require("../listkdb");
} catch(e) {
	var listkdb=require("./listkdb"); //for running from index.html
}

var kdbs=listkdb();
console.log(kdbs);