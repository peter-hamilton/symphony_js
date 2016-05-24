/* JavaScript code */

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

var cam_video_id = "camsource"

window.addEventListener('DOMContentLoaded', function() {
    // Assign the <video> element to a variable
    var video = document.getElementById(cam_video_id);
    var options = {
        "audio": false,
        "video": true
    };
    // Replace the source of the video element with the stream from the camera
    if (navigator.getUserMedia) {
        MediaStreamTrack.getSources(function(sourceInfos) {
            var source = null;
            for (var i = 0; i != sourceInfos.length; ++i) {
                var sourceInfo = sourceInfos[i];
                if (sourceInfo.kind === 'video' && sourceInfo.facing === 'environment') {
                    source = sourceInfo.id;
                    break;
                }
            }
            if (source) {
                options["video"] = {
                    optional: [{
                        sourceId: source
                    }]
                };
            }
            console.log(options);
            navigator.getUserMedia(options, function(stream) {
                video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
            }, function(error) {
                console.log(error)
            });

        });


        // Below is the latest syntax. Using the old syntax for the time being for backwards compatibility.
        // navigator.getUserMedia({video: true}, successCallback, errorCallback);
    } else {
        $("#qr-value").text('Sorry, native web camera streaming (getUserMedia) is not supported by this browser...')
        return;
    }
}, false);

$(document).ready(function() {
    var c = $("#camsource");
    c.width(document.body.clientWidth);
    console.log(document.body.clientWidth);
    if (!navigator.getUserMedia) return;
    cam = camera(cam_video_id);
    cam.start()
})