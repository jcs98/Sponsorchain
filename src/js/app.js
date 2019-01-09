// Options
let CLIENT_ID;
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

const signInPage = $('#sign-in-page')[0];
const homePage = $('#home-page')[0];

const authorizeButton = $('#authorize-button')[0];
const signoutButton = $('#signout-button')[0];
const content = $('#content')[0];
const registrationForm = $('#registration-form')[0];
const channelForm = $('#channel-form')[0];
const channelInput = $('#channel-input')[0];
const videoContainer = $('#video-container')[0];

const defaultChannel = 'thenewboston';

// Registration form submit
registrationForm.addEventListener('submit', e => {
  e.preventDefault();
  const channelName = $('#channel-name-input').val();
  const contact = $('#contact-input').val();
  const feeRate = $('#fee-rate-input').val();
  const maxViews = $('#max-views-input').val();

  if (channelName == "" || contact == "" || feeRate < 1 || maxViews < 1) {
    M.toast({ html: 'Please enter all fields!' })
    return;
  }
  console.log(channelName, contact, feeRate, maxViews);
  // registerNewCreator(channelName, contact, feeRate, maxViews);
  // getMyChannel();
});

// Form submit and change channel
channelForm.addEventListener('submit', e => {
  e.preventDefault();
  const channel = channelInput.value;
  getChannel(channel);
});


// Payment Modal click handlers

$(document).on('click', '.sponsor-btn', function (e) {
  const id = e.target.id;
  const title = e.target.title;
  const views = e.target.parentElement.childNodes[3].innerHTML;
  const iframe = e.target.parentElement.childNodes[1].outerHTML
  console.log(id, title, views, iframe);

  const data = `
    <h5>${title}</h5>
    <h4>${views}</h4>
    <div style="width: 50%">${iframe}</div>
    <h5>Rate: 10 wei / view</h5>
    <h5>Max: 1000 views / week</h5>
  `;

  $('#modal-left-content').html(data);
});

$(document).on('click', '#pay-btn', function (e) {
  console.log("hey", $('#email-message').val());
});


// Load auth2 library
function handleClientLoad() {
  import('./credentials.mjs').then(module => {
    CLIENT_ID = module.CLIENT_ID;
  });
  $('.modal').modal();
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
  const channelData = $('#channel-data')[0];
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
    .catch(err => M.toast({ html: 'No channel by that name' }));
}

// Add commas to number
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Display videos data
function showVideoData(data) {
  const videos = $('#video-container')[0];
  videos.innerHTML += data;
}

function getVideoData(videoId, title) {
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
      <a id="${videoId}" title="${title}" class="sponsor-btn modal-trigger red waves-effect waves-light btn-small right" href="#payment-modal">Sponsor</a>
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
        const title = item.snippet.title;
        getVideoData(videoId, title);

      });

      // Output videos
      videoContainer.innerHTML = output + videoContainer.innerHTML;
    } else {
      videoContainer.innerHTML = 'No Uploaded Videos';
    }
  });
}