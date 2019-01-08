// Options
let CLIENT_ID;
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

const signInPage = document.getElementById('sign-in-page');
const homePage = document.getElementById('home-page');

const authorizeButton = document.getElementById('authorize-button');
const signoutButton = document.getElementById('signout-button');
const content = document.getElementById('content');
const channelForm = document.getElementById('channel-form');
const channelInput = document.getElementById('channel-input');
const videoContainer = document.getElementById('video-container');

const defaultChannel = 'thenewboston';

// Form submit and change channel
channelForm.addEventListener('submit', e => {
  e.preventDefault();
  const channel = channelInput.value;
  getChannel(channel);
});

// Load auth2 library
function handleClientLoad() {
  import('./credentials.mjs').then(module => {
    CLIENT_ID = module.CLIENT_ID;
  });
  gapi.load('client:auth2', initClient);
}

// Init API client library and set up sign in listeners
function initClient() {
  gapi.client
    .init({
      discoveryDocs: DISCOVERY_DOCS,
      clientId: CLIENT_ID,
      scope: SCOPES
    })
    .then(() => {
      // Listen for sign in state changes
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
      // Handle initial sign in state
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
      authorizeButton.onclick = handleAuthClick;
      signoutButton.onclick = handleSignoutClick;
    });
}

// Update UI sign if state changes
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    homePage.style.display = 'block';
    signInPage.style.display = 'none';
    console.log(gapi.client);
    getChannel(defaultChannel);
  } else {
    homePage.style.display = 'none';
    signInPage.style.display = 'block';
  }
}

// Handle login
function handleAuthClick() {
  gapi.auth2.getAuthInstance().signIn();
}

// Handle logout
function handleSignoutClick() {
  gapi.auth2.getAuthInstance().signOut();
}

// Display channel data
function showChannelData(data) {
  const channelData = document.getElementById('channel-data');
  channelData.innerHTML = data;
}

// Get channel from API
function getChannel(channel) {
  gapi.client.youtube.channels
    .list({
      part: 'snippet,contentDetails,statistics',
      forUsername: channel
    })
    .then(response => {
      console.log(response);
      const channel = response.result.items[0];

      const output = `
          <span>Title: <span class="channel-details"> ${channel.snippet.title}</span></span>
          <a target="_blank" href="https://youtube.com/${
          channel.snippet.customUrl
        }">(Visit Channel)</a>
          <br>
          <span>Subscribers: <span class="channel-details"> ${numberWithCommas(
          channel.statistics.subscriberCount
        )}</span></span>
          <span>Views: <span class="channel-details"> ${numberWithCommas(
          channel.statistics.viewCount
        )}</span></span>
          <span>Videos: <span class="channel-details"> ${numberWithCommas(
          channel.statistics.videoCount
        )}</span></span>        
      `;
      showChannelData(output);

      const playlistId = channel.contentDetails.relatedPlaylists.uploads;
      requestVideoPlaylist(playlistId);
    })
    .catch(err => alert('No Channel By That Name'));
}

// Add commas to number
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Display videos data
function showVideoData(data) {
  const videos = document.getElementById('video-container');
  videos.innerHTML += data;
}

function getVideoData(videoId){
  const options = {
    id: videoId,
    part: 'statistics'
  }

  const req = gapi.client.youtube.videos.list(options);
  let viewsCount;
  req.execute(res => {
    // console.log(res);
    viewsCount = res.items[0].statistics.viewCount;
    // console.log(viewsCount);
    const videoOutput = `
      <div class="col s4 video-col">
      <iframe width="100%" height="auto" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
      <span class="views">views: ${numberWithCommas(viewsCount)}</span>
      <a class="red waves-effect waves-light btn-small right">Sponsor</a>
      </div>
      `;
    showVideoData(videoOutput);
  });
}

function requestVideoPlaylist(playlistId) {
  const requestOptions = {
    playlistId: playlistId,
    part: 'snippet,contentDetails',
    maxResults: 6
  };

  const request = gapi.client.youtube.playlistItems.list(requestOptions);

  request.then(response => {
    console.log(response.result.items);
    const playListItems = response.result.items;
    if (playListItems) {
      videoContainer.innerHTML = '';
      let output = '<br><h4 class="center-align">Latest Videos</h4>';

      // Loop through videos and append output
      playListItems.forEach(item => {
        const videoId = item.snippet.resourceId.videoId;
        getVideoData(videoId);        

      });

      // Output videos
      videoContainer.innerHTML = output + videoContainer.innerHTML;
    } else {
      videoContainer.innerHTML = 'No Uploaded Videos';
    }
  });
}