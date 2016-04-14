// Dependencies
var http = require('http'),
	fs = require('fs'),
	express = require('express'),
	rest = require('restler'),
	bodyParser = require('body-parser'),
	ffmetadata = require('ffmetadata'),
	request = require('request'),
	YoutubeMp3Downloader = require('youtube-mp3-downloader');

// MP3 Converter
var ytAudio = new YoutubeMp3Downloader({
	'ffmpegPath': '/usr/bin/ffmpeg',
	'outputPath': 'downloads', 
	'youtubeVideoQuality': 'highest',
	'parallelismFactor': 5
});

// Website
app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Download Locally
var download = function(uri, filename, callback){ // Try defining as function??
	request.head(uri, function(err, res, body){
		console.log('content-type:', res.headers['content-type']);
		console.log('content-length:', res.headers['content-length']);
		request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
	});
};

// Metatag Writer
var id3 = require('id3-writer'),
	writer = new id3.Writer();

function isValidVideoId(videoId) {
	return videoId != null;
}

function formatVideoTitle(videoTitle) {
	return videoTitle.replace(/ *\([^)]*\) */g,'').replace(/ *\[[^)]*\] */g,'');
}

function getSpotifyMetadata(downloadedAudio) {
	var spotifySearchUrl = 'https://api.spotify.com/v1/search?query='
	+ formatVideoTitle(downloadedAudio.videoTitle)
	+ '&offset=0&limit=1&type=track',
		spotifyDownloadUrl = 'downloads/artwork/spotify/';
	rest.get(spotifySearchUrl).on('complete', function(spotifyResults) {
		if (spotifyResults.tracks.items[0] != null) {
			download(
				spotifyResults.tracks.items[0].album.images[0].url, 
				spotifyDownloadUrl + downloadedAudio.videoId + '.jpg', 
				function() {
					console.log('Spotify: ' + spotifyResults.tracks.items[0].toString());
					return {
						title: spotifyResults.tracks.items[0].name,
						artist: spotifyResults.tracks.items[0].artists[0].name,
						album: spotifyResults.tracks.items[0].album.name,
						cover: spotifyDownloadUrl + downloadedAudio.videoId + '.jpg'
					};
				}
			);
		}
	});
}

function getYouTubeMetadata(downloadedAudio) {
	return {
		title: downloadedAudio.title,
		artist: downloadedAudio.artist,
		album: '',
		cover: 'downloads/artwork/unknown.jpg'	
	};
}

function getMetadata(downloadedAudio) {
	var metadata = [];
	if(getSpotifyMetadata(downloadedAudio) != null) {
		metadata[metadata.length] = getSpotifyMetadata(downloadedAudio);
	}
	if(getYouTubeMetadata(downloadedAudio) != null) {
		metadata[metadata.length] = getYouTubeMetadata(downloadedAudio);
	}
	return metadata;
}

// Homepage
app.get('/', function(request, response) {
	response.sendfile('index.html', {root: '.'}); 
});

// Request Video
app.get('/metadata/:videoId', function(request, response) {
	if(isValidVideoId(request.params.videoId)) {
		ytAudio.download([request.params.videoId], function(downloadedAudio) {
			response.json({
				metadata: getMetadata(downloadedAudio[0]),
				download: downloadedAudio[0].file
			});
			console.log('Video Downloaded & Tagged: ' + downloadedAudio.videoId);
		});
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