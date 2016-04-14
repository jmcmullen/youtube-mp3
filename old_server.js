var http = require('http'),
express = require('express'),
rest = require('restler'),
bodyParser = require('body-parser'),
fs = require('fs'),
request = require('request'),
YoutubeMp3Downloader = require('youtube-mp3-downloader');

var YD = new YoutubeMp3Downloader({
'ffmpegPath': '/usr/bin/ffmpeg',
'outputPath': 'downloads', 
'youtubeVideoQuality': 'highest',
'parallelismFactor': 5
});

var ffmetadata = require('ffmetadata');

app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var download = function(uri, filename, callback){
request.head(uri, function(err, res, body){
console.log('content-type:', res.headers['content-type']);
console.log('content-length:', res.headers['content-length']);
request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
});
};

var id3 = require('id3-writer'),
writer = new id3.Writer();

app.get('/', function(request, response) {
response.sendfile('index.html', {root: '.'}); 
});

app.get('/dl/:video', function(request, response) {
if(request.params.video != null) {
try {
YD.download([request.params.video], function(result) {
console.log(result);
if(result.length > 0) {
rest.get('https://api.spotify.com/v1/search?query=' + result[0].videoTitle.replace(/ *\([^)]*\) */g,'').replace(/ *\[[^)]*\] */g,'') + '&offset=0&limit=3&type=track').on('complete', function(data) {
if(data.tracks.items[0] != null) {
download(data.tracks.items[0].album.images[0].url, 'downloads/artwork/' + result[0].videoId + '.jpg', function() {
var mp3 = new id3.File(result[0].file),
coverImage = new id3.Image('downloads/artwork/' + result[0].videoId + '.jpg'),
meta = new id3.Meta({
artist: data.tracks.items[0].artists[0].name,
album: data.tracks.items[0].album.name,
title: data.tracks.items[0].name,
track: data.tracks.items[0].track_number,
}, [coverImage]);
writer.setFile(mp3).write(meta, function(err) {
if (err) {
console.error('Error: ' + err);
} else {
var metadata = [{
artist: data.tracks.items[0].artists[0].name,
album: data.tracks.items[0].album.name,
title: data.tracks.items[0].name,
cover: 'downloads/artwork/' + result[0].videoId + '.jpg'
},
{
artist: result[0].artist,
title: result[0].title,
album: '',
cover: 'downloads/artwork/unknown.jpg'
}];
for(i in data.tracks.items) {
metadata[metadata.length] = {

}
}
console.log('Success: ' + result[0].videoId);
response.json({
result: true,
metadata,
download: result[0].file
});
}
});
})
} else {
var mp3 = new id3.File(result[0].file),
meta = new id3.Meta({
artist: result[0].artist,
title: result[0].title
});
writer.setFile(mp3).write(meta, function(err) {
if (err) {
console.error('Error: ' + err);
} else {
console.log('Success: ' + result[0].videoId);
response.json({
result: true,
metadata: [{
artist: result[0].artist,
title: result[0].title,
album: '',
cover: 'downloads/artwork/unknown.jpg'
}],
download: result[0].file
});
}
});
} 
});
}  
});
} catch (err) {
response.json({
result: false,
error: 'Invalid video.'
}); 
}
}
});


app.get('/downloads/artwork/:file', function(request, response) {
response.sendfile(request.params.file, {root: './downloads/artwork/'}); 
});

app.get('/downloads/:file', function(request, response) {
response.setHeader('Content-disposition', 'attachment; filename=' + request.params.file);
response.sendfile(request.params.file, {root: './downloads/'}); 
});

app.post('/downloads/:file', function(request, response) {
console.log(request.body);
var mp3 = new id3.File('downloads/' + request.params.file),
coverImage = new id3.Image(request.body.cover),
meta = new id3.Meta({
artist: request.body.artist,
title: request.body.title,
album: request.body.album
}, [coverImage]);
writer.setFile(mp3).write(meta, function(err) {
if (err) {
console.error('Error: ' + err);
} else {
response.setHeader('Content-disposition', 'attachment; filename=' + request.params.file);
response.sendfile(request.params.file, {root: './downloads/'});  
}
});
});

app.listen(3000);
console.log('[Info] Youtube music has started on port 3000.');