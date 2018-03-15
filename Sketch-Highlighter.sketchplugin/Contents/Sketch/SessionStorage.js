module.exports = new function(){
	var ns = "com.matt-curtis.sketch-highlighter", nsPrefix = ns + ".";
	var dictionary = NSThread.mainThread().threadDictionary();

	this.get = function(key){
		key = nsPrefix + key;

		return dictionary[key];
	};

	this.set = function(key, value){
		key = nsPrefix + key;

		dictionary[key] = value;
	};
};