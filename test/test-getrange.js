var kde=require("../index");
kde.open("sample",function(err,db){
	db.getRange(1100,1261,function(data){
		console.log(data);
	});
});