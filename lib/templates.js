var Music = require("./music.js").Music;
var Tone = require("./tone.js").Tone;
var Note = require("./note.js").Note;
var Chord = require("./chord.js").Chord;
var Pitch = require("./pitch.js").Pitch;



var jazz = exports.jazz = new Music();
var stage1 = new Tone({ 'id': 'stage1', 'type': 'stage', 'arguments': { 'icon': 'fa-folder-open' } });
stage1.putRegisteredArgument('stageContent', null, "clip", { 'type': 'clipboard' }, true);
// var launchSet = new Pitch({'id': 'launchSet', 'flags':Pitch.FLAG_LOCKED | Pitch.FLAG_IN, 'type':'[launchable]','value':['p1launch','p2launch']})
// stage1.addPitch(launchSet);
jazz.addStaticTone(stage1);

var stage2 = new Tone({ 'id': 'stage2', 'type': 'stage', 'arguments': { 'icon': 'fa-folder-open' } });
stage2.putRegisteredArgument('stageContent', null, "clip", { 'type': 'clipboard'}, true);
jazz.addStaticTone(stage2);

var contact1 = new Tone({ 'id': 'contact1', 'type': 'contact', 'arguments': { 'icon': 'fa-folder-open' } });
contact1.putRegisteredArgument('contactPicture', 'http://www.cs.toronto.edu/~jotacosta/wp-content/uploads/2012/04/IMG_47851-305x406.jpg',"image", { 'type': 'image' });

jazz.addStaticTone(contact1);

var contact2 = new Tone({ 'id': 'contact2', 'type': 'contact', 'arguments': { 'icon': 'fa-folder-open' } });
contact2.putRegisteredArgument('contactPicture', 'http://www.dgp.toronto.edu/~dwigdor/wp-content/uploads/Daniel_Wigdor.jpg',"image", { 'type': 'image' });
contact2.putRegisteredArgument('contactName', 'Vanilla Ice', { 'type': 'text' });
contact2.putRegisteredArgument('contactWebsite', 'http://www.dgp.toronto.edu/~dwigdor/','url', { 'type': 'url' });
jazz.addStaticTone(contact2);


var dgp = new Tone({ 'id': 'dgp', 'type': 'place', 'arguments': { 'icon': 'fa-building-o' } });
dgp.putRegisteredArgument('website', 'http://www.dgp.toronto.edu/', 'url', { 'type': 'url' });
dgp.putRegisteredArgument('location', "https://www.google.ca/maps/place/Bahen+Centre+for+Information+Technology/@43.6595981,-79.3992125,17z/data=!3m1!4b1!4m2!3m1!1s0x882b34c75165c957:0x6459384147b4b67b","url", { 'type': 'url' });


jazz.addStaticTone(dgp);

var clubhouse = new Tone({ 'id': 'clubhouse', 'type': 'place', 'arguments': { 'icon': 'fa-building-o' } });
clubhouse.putRegisteredArgument('website', 'http://www.leakingfaucet.com/clubhouse/clubhouse.php', 'url', { 'type': 'url' });
clubhouse.putRegisteredArgument('location', 'https://www.google.ca/maps/place/The+Clubhouse+Sandwich+Shop/@43.6581728,-79.4020658,17z/data=!3m1!4b1!4m2!3m1!1s0x882b34c1aac75177:0x1b6559c5031a54e5', 'url', { 'type': 'url' });
jazz.addStaticTone(clubhouse);

//TODO:remove (Debugging) 
if (require.main === module) {

    console.log(jazz);
}
