var db = require("../models"),
   path = require("path"),
   mailer = require("../lib/sendgrid_mailer.js");

module.exports = function(app) {

   app.use("/challenge/*?", function(req, res, next) {
      if (!req.user) {
         console.log(req.user);
         return res.status(401).sendFile(path.join(__dirname, "../public/plsLogin.html"));
      }
      next();
   });

   app.post('/challenge/new', function(req, res) { // post route for a new challenge, also a parent to challenge instance
      const recipient_name = req.body.challenged_name,
         recipient = req.body.challenged,
         template_name = req.body.challenge_name,
         template_rule = req.body.rules,
         proof = req.body.postLink;

      // not great but will do for now
      const createInstance = function(newInstance) {
         db.Instance.create(newInstance).then(function(data) { // post a new row in instance table.
            console.log(data);
            mailer(req.headers.origin, {
               email: recipient,
               username: recipient_name,
               challenger_name: req.user.name,
               challenger_id: req.user.id,
               instance_id: data.challenge_id
            }, 1);
            res.status(200).send("/user/dashboard");
         });
      };
      
      console.log(req.body);

      const newChallenge = { //grab request body info to create new challenge object
            name: template_name,
            rule: template_rule,
            creator_id: req.user.id
         },
         newInstance = { // grab instance items
            challenger_proof: proof,
            issuer_id: req.user.id,
            template_id: req.body.templateId || null,
            accepter_id: req.body.userId || null
         };

      if (!newInstance.template_id) {
         db.Template.create(newChallenge).then(function(results) { //post a new row in the challenge table.
            //grab the newly created template_id and add it to the newInstance here
            newInstance["template_id"] = results.dataValues.id;
            createInstance(newInstance);
         });
      } else {
         createInstance(newInstance);   
      }
   });

   app.put('/challenge/instance/accept', function(req, res) { //update the instance state  (user accepted challenge)
      console.log(req.originalUrl);

      db.Instance.update({
         state: 'challenge-accepted'
      }, {
         where: {
            challenge_id: req.query["instance"]
         }
      }).then(function(results) {
         console.log(results);
         db.Instance.findOne({
            where: {
               challenge_id: req.query["instance"]
            },
            include: [{
               model: db.User,
               as: "issued"
            }, {
               model: db.Template
            }]
         }).then((data) => {
            console.log(data);
            console.log(data.Template.name);
            mailer(req.headers.origin, {
               email: data.issued.email,
               username: req.user.name,
               challenger_name: data.issued.name,
               challenge_name: data.Template.name
            }, 2);
            res.status(200).send("/user/dashboard");
         });
      });
   });

   app.put('/challenge/instance/reject', function(req, res) { //update the instance state  (user rejected challenge)
      db.Instance.update({
         state: 'challenge-rejected'
      }, {
         where: {
            challenge_id: req.query["instance"]
         }
      }).then(function(results) {
         console.log(results);
         db.Instance.findOne({
            where: {
               challenge_id: req.query["instance"]
            },
            include: [{
               model: db.User,
               as: "issued"
            }, {
               model: db.Template
            }]
         }).then((data) => {
            console.log(data);
            console.log(data.Template.name);
            mailer(req.headers.origin, {
               email: data.issued.email,
               username: req.user.name,
               challenger_name: data.issued.name,
               challenge_name: data.Template.name
            }, 5);
            res.status(200).send("/user/dashboard");
         });
      });
   });

   app.put('/challenge/instance/prove', function(req, res) { //update the instance state  (user added proof)
      console.log(req.body.link);

      db.Instance.update({
         state: 'provided-proof',
         challenged_proof: req.body.link
      }, {
         where: {
            challenge_id: req.query["instance"]
         }
      }).then(function(results) {
         db.Instance.findOne({
            where: {
               challenge_id: req.query["instance"]
            },
            include: [{
               model: db.User,
               as: "issued"
            }, {
               model: db.Template
            }]
         }).then((data) => {
            console.log(data);
            mailer(req.headers.origin, {
               email: data.issued.email,
               username: data.issued.name,
               challenge_name: data.Template.name
            }, 3);
            res.status(200).send("/user/dashboard");
         });
      });
   });

   app.put('/challenge/instance/proofreject', function(req, res) { //update the instance state  (user proof rejected!)

      db.Instance.update({
         state: 'proof-rejected'
      }, {
         where: {
            challenge_id: req.query["instance"]
         }
      }).then(function(results) {
         db.Instance.findOne({
            where: {
               challenge_id: req.query["instance"]
            },
            include: [{
               model: db.User,
               as: "accepted"
            }, {
               model: db.Template
            }]
         }).then((data) => {
            console.log(data);
            mailer(req.headers.origin, {
               email: data.accepted.email,
               username: data.accepted.name,
               challenge_name: data.Template.name
            }, 6);
            res.status(200).send("/user/dashboard");
         });
      });
   });

   app.put('/challenge/instance/proofaccept', function(req, res) { //update the instance state  (user proof accepted!)
      db.Instance.update({
         state: 'proof-accepted'
      }, {
         where: {
            challenge_id: req.query["instance"]
         }
      }).then(function(results) {
         db.Instance.findOne({
            where: {
               challenge_id: req.query["instance"]
            },
            include: [{
               model: db.User,
               as: "accepted"
            }, {
               model: db.Template
            }]
         }).then((data) => {
            console.log(data);
            mailer(req.headers.origin, {
               email: data.accepted.email,
               username: data.accepted.name,
               challenge_name: data.Template.name
            }, 4);
            res.status(200).send("/user/dashboard");
         });
      });
   });

   app.delete("/challenge/instance", function(req, res) {
      console.log(req.query["instance"]);
      console.log(req.query["identity"]);

      const optionObj = {};
      optionObj[req.query["identity"]] = null;
      console.log(optionObj);

      db.Instance.findOne({
         where: {
            challenge_id: req.query["instance"]
         }
      }).then((data) => {
         let isNull = req.query["identity"] === "issuer_id" ? data.accepter_id : data.issuer_id;
         console.log(isNull);
         console.log(optionObj);
         if (!isNull) {
            db.Instance.destroy({
               where: {
                  challenge_id: req.query["instance"]
               }
            }).then((result) => {
               res.status(200).send("delete record!!");
            });
         } else {
            db.Instance.update(optionObj, {
               where: {
                  challenge_id: req.query["instance"]
               }
            }).then((result) => {
               res.status(200).send("delete association!!");
            });
         }
      }).catch((err) => {
         console.log(err);
      });
   });

   app.put('/challenge/instance/archive-success', function(req, res) { //update the instance state  (user proof accepted! acknowledged)
      db.Instance.update({
         state: 'archive-success'
      }, {
         where: { id: req.body.id } //grab challenge id from req.
      }).then(function(results) {
         res.redirect('/dashboard');
      });
   });

   app.put('/challenge/instance/archive-fail', function(req, res) { //update the instance state  (user proof rejected! acknowledged)
      db.Instance.update({
         state: 'archive-fail'
      }, {
         where: { id: req.body.id } //grab challenge id from req.
      }).then(function(results) {
         res.redirect('/user/dashboard');
      });
   });

   // app.get('/challenge/instance/id/:id', function(req, res) { //when called, returns this instance's data
   //    db.Instance.findAll({
   //       where: { id: req.params.id } //grab challenge id
   //    }).then(function(results) {
   //       res.json(results);
   //    });
   // });

   // app.get('/challenge/template/id/:id', function(req, res) { //when called, returns this challenge template data
   //    db.Template.findAll({
   //       where: { id: req.params.id } //grab challenge id
   //    }).then(function(results) {
   //       res.json(results);
   //    });
   // });

   //use this while we keep the instance
   /*app.put('/challenge/instance/reject', function(req,res){//update the instance complete to true (user proof accepted!)
       db.Instance.update({
           completeState:true
           },{
               where:{id:req.body.id} //grab challenge id from req.
           }).then(function(results){
               res.redirect('/home');
           })
   })*/

   // for when we want to get rid of instance
   /*app.delete('/challenge/instance/finish', function(req,res){
       db.Instance.destroy({
           {where:{id:req.body.id}} //grab challenge id to be destroyed
       }).then(function(results){
           res.json(results);
       })
   })*/

   // //new challenge instance should be made at the same time as the challenge
   // app.post('/challenge/instance/new', function(req, res) { //post route for a challenge instance , child of user and challenge
   //    var newChallengeInstance = { // need to know all vars required (what doesn't have a default value in model)
   //       template_id: req.body[template_id],
   //       challenger_proof: req.body.proof,
   //       issuer_id: req.user.user,
   //       //issuerName:req.body.issuer,
   //       accepter_id: req.body.challenged
   //       //startState should be default defined boolean
   //       //gameState should be default value defined boolean
   //    };
   //    db.Instance.create(newChallengeInstance).then(function(results) { //post a new row in the challenge_instance table
   //       res.redirect('/dashboard');
   //    });
   // });

};