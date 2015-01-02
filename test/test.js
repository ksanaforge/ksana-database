try {
	var Kde=require("../index");
} catch(e) {
	var Kde=require("./index"); //for running from index.html
}
var main=null;
if (typeof document!="undefined") {
	main=document.getElementById("main");
}

Kde.open("yijing",function(err,db){
	db.get(["fileContents",0,1],function(data){
		if (main) {
			main.value=data;
		} else {
			console.log(data);
		}
	})

});
