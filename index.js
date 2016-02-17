(function() {
	"use strict";

	var appId = "T7RZ3S7mWZdDBnA5R",
	    appSecret = "aed17be2-8abe-4f27-817c-0bec928b1ccd";

	var dummyJson = '{"success":true,"data":{"username":"riukkie","_id":"dcrcpbRkeFsg43MJE","corporationName":"Black Omega Security","corporationID":"263585335","allianceName":"The OSS","allianceID":"655846070","usernameNormalized":"riukkie","group":"OMEGA","groupName":"Black Omega Security","roles":["Member","FC","Ping","Recon"],"groupType":"Alliance","rolesNormalized":["OMEGA.Member","OMEGA.FC","OMEGA.Ping","OMEGA.Recon"]},"main":{"_id":"aeJXauGrrXgsDFsJX","characterID":"739897991","characterName":"riukkie","corporationName":"Black Omega Security","corporationID":"263585335","allianceID":"655846070","allianceName":"The OSS"},"characters":[{"_id":"8Ykyhhyam4gzjKTYB","characterID":"93680864","characterName":"Wouline Wessette","corporationName":"Astrid Research","corporationID":"98171952","allianceID":"99005206","allianceName":"Space Violence","hidden":true},{"_id":"D3rWHK5EjkWCke9ix","characterID":"92967780","characterName":"En Simalia","corporationName":"Astrid Research","corporationID":"98171952","allianceID":"99005206","allianceName":"Space Violence","hidden":true},{"_id":"QYQzDL7EHe3NPRD35","characterID":"91726331","characterName":"En Tilvaine","corporationName":"Black Omega Security","corporationID":"263585335","allianceID":"655846070","allianceName":"The OSS"},{"_id":"R79C9aJSkdqAMP9Cr","characterID":"92784467","characterName":"En Nakrar","corporationName":"Imperial Shipment","corporationID":"1000072","allianceID":"0","allianceName":""},{"_id":"S6BW8fPpqkzoLwEn4","characterID":"91589188","characterName":"Riukkie Audeles","corporationName":"Astrid Research","corporationID":"98171952","allianceID":"0","allianceName":"","hidden":true},{"_id":"WEyTo3LwYie2mwCHJ","characterID":"92728552","characterName":"En Aldard","corporationName":"Sebiestor Tribe","corporationID":"1000046","allianceID":"0","allianceName":"","hidden":true},{"_id":"bCEa6xei2Q2PqFK7R","characterID":"91588619","characterName":"Riukkie Eistiras","corporationName":"Astrid Research","corporationID":"98171952","allianceID":"99005206","allianceName":"Space Violence","hidd* Connection #0 to host auth.oss.rocks left intact en":true},{"_id":"nHDxMtahPJpfjGw6n","characterID":"93680923","characterName":"Miu Audanie","corporationName":"Black Omega Security","corporationID":"263585335","allianceID":"655846070","allianceName":"The OSS"},{"_id":"ygbKmtFNMfEapaX47","characterID":"95041491","characterName":"Macha Isayeki","corporationName":"Astrid Research","corporationID":"98171952","allianceID":"99005206","allianceName":"Space Violence","hidden":true},{"_id":"zxeJwfXqQGEnZzqeh","characterID":"95986175","characterName":"xstazy","corporationName":"Center for Advanced Studies","corporationID":"1000169","allianceID":"0","allianceName":"","hidden":true},{"_id":"aeJXauGrrXgsDFsJX","characterID":"739897991","characterName":"riukkie","corporationName":"Black Omega Security","corporationID":"263585335","allianceID":"655846070","allianceName":"The OSS"}]}'

	var async = require('async'),
	    groups = module.parent.require('./groups'),
	    request = require('request'),
	    user = module.parent.require('./user');

	function loadUserGroups(userId, callback){
		user.getUserData(userId,function(err,data){
			if (data.hasOwnProperty('authToken')){
				//console.log("[OssAuth] - data.authToken: " + data.authToken);
				request({
					headers: {
						"Authorization": "0e788543-f070-4ba9-a841-82ea7a1a386c",
						"X-App-Id": appId,
						"X-App-Secret": appSecret,
						"X-Scopes": "Roles"
					},
					uri: 'https://auth.oss.rocks/api/authorize/',
					method: 'GET'
					}, 
					function (err, res, body) {
						if(!err){
							var parsedJson = JSON.parse(body);
							//console.log(parsedJson);

							var roles = parsedJson.data.rolesNormalized

							function forEachRole(element, index, array){
								//console.log('Role ' + element);
								try{
									async.waterfall([
										// Create group is not exists
										function (next) {
											groups.exists(element, function(err,data){
												if(data || true){
													//console.log("[OssAuth] - " + element + " exists");
													next()
												}
												else{
													//console.log("[OssAuth] - " + element + " doesn't exist");
													groups.create({
														"name":element, 
														"description":"auth group"
													}, next);
												}
											});
										},
										// Join group if not already in
										function (next) {
											try{
												groups.isMember(userId,element,function(err, data){
													if(!data)
														groups.join(element, userId);
												});
											}
											catch(err) {
												console.log("[OssAuth] - Role " + element + " join error: " + err);
											}
										}
									]);
								}
								catch(err) {
									console.log("[OssAuth] - Role " + element + " creation error: " + err);
								}

							}

							function leaveUnsetRoles(roles, callback){
								groups.isMember(userId,"administrators",function(err, isadmin){
									groups.leaveAllGroups(userId,function(){
										groups.join("registered-users", userId, callback);
										if(isadmin)
											groups.join("administrators", userId, callback);
										else
											callback();
									});
								});
							}

							// Drop all roles then assign new
							async.waterfall([
								function(next) {
									leaveUnsetRoles(roles, next);
								},
								function(next){
									roles.forEach(forEachRole);
								}
							]);
						}
						else
							console.log("[OssAuth] - auth request error " + err);
					}
				);
			}
		});
	}

	var OssAuth = {
		appLoad: function(params, callback) {
			function getToken(req, res, next){
				user.setUserField(req.uid, "authToken", req.params.token);
				loadUserGroups(req.uid);
				res.redirect("/");
			}
			function goToAuth(req, res, next){
				res.redirect("https://auth.oss.rocks/authorize/" + appId + "?r=http://oss.yohann-gely.com/token/");
			}

			console.log("[OssAuth] - appLoad");
			params.router.get('/token/:token', getToken);
			params.router.get('/token/', goToAuth);
			callback();
		},
		
		userConnect: function(userId, callback) {
			//console.log("[OssAuth] - userConnect");
			loadUserGroups(userId);
		}
	};

	module.exports = OssAuth;
})();
