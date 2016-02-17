(function() {
	"use strict";

	var appId = "T7RZ3S7mWZdDBnA5R",
	    appSecret = "aed17be2-8abe-4f27-817c-0bec928b1ccd",
	    checkFrequency = 30; // in secondes

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
						"Authorization": data.authToken,
						"X-App-Id": appId,
						"X-App-Secret": appSecret,
						"X-Scopes": "Roles"
					},
					uri: 'https://auth.oss.rocks/api/authorize/',
					method: 'GET'
					}, 
					function (err, res, body) {
						if(!err){
							try{
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
							catch(err) {
								console.log("[OssAuth] - Parse Json error: "+ err);
							}
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
				if(req.uid > 0){
					user.setUserField(req.uid, "authToken", req.params.token);
					loadUserGroups(req.uid);
				}
				res.redirect("/");
			}
			function goToAuth(req, res, next){
				res.redirect("https://auth.oss.rocks/authorize/" + appId + "?r=http://oss.yohann-gely.com/token/");
			}

			//console.log("[OssAuth] - appLoad");
			params.router.get('/token/:token', getToken);
			params.router.get('/token/', goToAuth);
			callback();
		},
		
		userConnect: function(userId, callback) {
			//console.log("[OssAuth] - userConnect");
			loadUserGroups(userId);
		},
		rolesCheck: function(params, callback) {
			//console.log("[OssAuth] - rolesCheck");
			//console.log(params.uid);
			if(params.uid>0){
				user.getUserData(params.uid,function(err,data){
					if (data.hasOwnProperty('authToken')){
						if (!data.hasOwnProperty('nextAuthCheck')){
							//console.log("[OssAuth] - rolesChecked");
							loadUserGroups(params.uid);
							user.setUserField(params.uid, "nextAuthCheck", new Date(new Date().getTime()+checkFrequency*1000));
						}
						else if(new Date(data.nextAuthCheck) < new Date(new Date().getTime())){
							//console.log("[OssAuth] - rolesChecked");
							loadUserGroups(params.uid);
							user.setUserField(params.uid, "nextAuthCheck", new Date(new Date().getTime()+checkFrequency*1000));
						}
					}
				});
			}
			callback(null, params);
		}
	};

	module.exports = OssAuth;
})();