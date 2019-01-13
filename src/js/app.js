// Options
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

const signInPage = $('#sign-in-page')[0];
const homePage = $('#home-page')[0];
const defaultChannel = 'thenewboston';

App = {
  web3Provider: null,
  contracts: {},

  init: async function () {
    // Load data
    return await App.initWeb3();
  },

  initWeb3: async function () {
    // Modern dapp browsers...
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.enable();
      } catch (error) {
        // User denied account access...
        console.error("User denied account access")
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
    }
    web3 = new Web3(App.web3Provider);

    return App.initContract();
  },

  initContract: function () {
    // $.getJSON('Sponsor.json', function (data) {
    //   var SponsorArftifact = data;
    //   App.contracts.Sponsor = TruffleContract(SponsorArftifact);
    //   App.contracts.Sponsor.setProvider(App.web3Provider);
    //   return App.markAdopted();
    // });

    return App.bindEvents();
  },

  bindEvents: function () {
    $('#authorize-button').click(App.handleAuthClick);
    $('#signout-button').click(App.handleSignoutClick);

    $(document).on('click', '.sponsor-btn', App.handleSponsorBtnClick);
    $('#pay-btn').click(App.handlePayBtnClick);
    $('#update-btn').click(App.handleUpdateBtnClick);

    $('#registration-form').submit(App.handleRegistrationFormSubmit);
    $('#channel-form').submit(App.handleChannelFormSubmit);
  },

  // Load auth2 library
  handleClientLoad: function () {
    import('./credentials.mjs').then(module => {
      CLIENT_ID = module.CLIENT_ID;
    });
    $('.modal').modal();
    gapi.load('client:auth2', App.initClient);
  },

  // Init API client library and set up sign in listeners
  initClient: function () {
    gapi.client
      .init({
        discoveryDocs: DISCOVERY_DOCS,
        clientId: CLIENT_ID,
        scope: SCOPES
      })
      .then(() => {
        // Listen for sign in state changes
        gapi.auth2.getAuthInstance().isSignedIn.listen(App.updateSigninStatus);
        // Handle initial sign in state
        App.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
      });
  },

  // Update UI sign if state changes
  updateSigninStatus: function (isSignedIn) {
    if (isSignedIn) {
      homePage.style.display = 'block';
      signInPage.style.display = 'none';
      console.log(gapi.client);
      App.getChannel(defaultChannel);
    } else {
      homePage.style.display = 'none';
      signInPage.style.display = 'block';
    }
  },


  // Click handlers
  handleAuthClick: function () {
    gapi.auth2.getAuthInstance().signIn();
  },

  handleSignoutClick: function () {
    gapi.auth2.getAuthInstance().signOut();
  },

  handleSponsorBtnClick: function (e) {
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
  },

  handlePayBtnClick: function (e) {
    console.log("hey", $('#email-message').val());
  },

  handleUpdateBtnClick: function (e) {
    console.log("update", $('#fee-rate-update-input').val(), $('#max-views-update-input').val());
  },


  // Form submit handlers
  handleRegistrationFormSubmit: function (e) {
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
  },

  handleChannelFormSubmit: function (e) {
    e.preventDefault();
    const channel = $('#channel-input').val();
    App.getChannel(channel);
  },


  // Add commas to number (helper)
  numberWithCommas: function (x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // Get channel from API
  getChannel: function (channel) {
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
          <span>Subscribers: <span class="channel-details"> ${App.numberWithCommas(
            channel.statistics.subscriberCount
          )}</span></span>
          <span>Views: <span class="channel-details"> ${App.numberWithCommas(
            channel.statistics.viewCount
          )}</span></span>
          <span>Videos: <span class="channel-details"> ${App.numberWithCommas(
            channel.statistics.videoCount
          )}</span></span>        
      `;
        $('#channel-data').html(output);

        const playlistId = channel.contentDetails.relatedPlaylists.uploads;
        App.requestVideoPlaylist(playlistId);
      })
      .catch(err => M.toast({ html: 'No channel by that name' }));
  },

  // Get individual video data
  getVideoData: function (videoId, title) {
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
      <span class="views">views: ${App.numberWithCommas(viewsCount)}</span>
      <a id="${videoId}" title="${title}" class="sponsor-btn modal-trigger red waves-effect waves-light btn-small right" href="#payment-modal">Sponsor</a>
      </div>
      `;
      $('#video-container')[0].innerHTML += videoOutput;
    });
  },

  // Get video playlist
  requestVideoPlaylist: function (playlistId) {
    const requestOptions = {
      playlistId: playlistId,
      part: 'snippet,contentDetails',
      maxResults: 6
    };
    const request = gapi.client.youtube.playlistItems.list(requestOptions);
    const videoContainer = $('#video-container')[0];

    request.then(response => {
      console.log(response.result.items);
      const playListItems = response.result.items;
      videoContainer.innerHTML = '';
      if (playListItems) {
        // Loop through videos and append output
        playListItems.forEach(item => {
          const videoId = item.snippet.resourceId.videoId;
          const title = item.snippet.title;
          App.getVideoData(videoId, title);
        });
      } else {
        videoContainer.innerHTML = 'No Uploaded Videos';
      }
    });
  }

};

$(function () {
  $(window).load(function () {
    App.init();
  });
});