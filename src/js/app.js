// Options
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

const signInPage = $('#sign-in-page')[0];
const homePage = $('#home-page')[0];
const registrationForm = $('#registration-form')[0];
const myChannelPanel = $('#my-channel')[0];

App = {
  web3Provider: null,
  contracts: {},
  currentChannel: 'unboxtherapy',
  currentChannelFeeRate: 0,
  currentChannelMaxViews: 0,
  currentChannelCreatorContact: '',
  myChannel: '',

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
    $.getJSON('Sponsor.json', function (data) {
      const SponsorArftifact = data;
      App.contracts.Sponsor = TruffleContract(SponsorArftifact);
      App.contracts.Sponsor.setProvider(App.web3Provider);
    });
    return App.bindEvents();
  },

  bindEvents: function () {
    $('#authorize-button').click(App.handleAuthClick);
    $('#signout-button').click(App.handleSignoutClick);

    $(document).on('click', '.sponsor-btn', App.handleSponsorBtnClick);
    $('#payment-form').submit(App.handlePaymentFormSubmit);

    $(document).on('click', '.cancel-payment-btn', App.handleCancelPaymentBtnClick);
    $(document).on('click', '.claim-payment-btn', App.handleClaimPaymentBtnClick);

    $(document).on('click', '#update-details-btn', App.handleUpdateDetailsBtnClick);
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
      App.getChannel(App.currentChannel).then(response => {
        const channel = response.result.items[0];
        App.setRightPanelChannel(channel);
        App.setMyChannelPanel();
      })
        .catch(err => M.toast({ html: 'No channel by that name' }));
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
    const views = e.target.parentElement.childNodes[3].innerHTML.replace("views: ", "");
    const iframe = e.target.parentElement.childNodes[1].outerHTML

    const data = `
    <h5>${title}</h5>
    <h6>ID: <span id="current-video-id">${id}</span></h6>
    <h5>views: <span id="current-video-views">${views}</span></h5>
    <div style="width: 50%">${iframe}</div>
    <h5>Rate: <span id="creator-fee">${App.currentChannelFeeRate.toString()}</span> ETH / view</h5>
    <h5>Max: <span id="creator-max-views">${App.currentChannelMaxViews.toString()}</span> views / week</h5>
  `;

    $('#modal-left-content').html(data);

    $('#payment-amount-input').attr({
      "min": App.currentChannelFeeRate, "max": App.currentChannelFeeRate * App.currentChannelMaxViews
    });

    $('#payment-amount-input-label').html(
      "Amount ( from " + App.currentChannelFeeRate
      + " to " + ((App.currentChannelFeeRate * 10e18) * App.currentChannelMaxViews) / 10e18 + " ETH )");
  },

  handleCancelPaymentBtnClick: function (e) {
    const videoId = e.target.id;
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      const account = accounts[0];

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.cancelPayment(videoId, { from: account });
      }).then(function (result) {
        M.toast({ html: 'Payment Cancelled and Refunded Successfully!' });
        console.log(result);

        // Update UI if successful
        App.getChannel(App.currentChannel).then(response => {
          const channel = response.result.items[0];
          App.setRightPanelChannel(channel);
        })
          .catch(err => console.log(err));

        App.setMyChannelPanel();

      }).catch(function (err) {
        console.log(err.message);
      });

    });
  },

  handleClaimPaymentBtnClick: function (e) {
    const videoId = e.target.id;
    const currentViews = e.target.title;
    console.log(videoId, currentViews);
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      const account = accounts[0];

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.makeWithdrawal(videoId, currentViews, { from: account });
      }).then(function (result) {
        console.log(result);

        // Update UI if successful
        App.getChannel(App.currentChannel).then(response => {
          const channel = response.result.items[0];
          App.setRightPanelChannel(channel);
        })
          .catch(err => console.log(err));

        App.setMyChannelPanel();

      }).catch(function (err) {
        console.log(err.message);
      });

    });
  },

  handleUpdateDetailsBtnClick: function (e) {
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      const account = accounts[0];

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.getFeeRate(App.myChannel, { from: account });
      }).then(function (feeRate) {
        $('#fee-rate-update-input').val(web3.fromWei(feeRate, 'ether'));
      }).catch(function (err) {
        console.log(err.message);
      });

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.getMaxViewsPerWeek(App.myChannel, { from: account });
      }).then(function (maxViews) {
        $('#max-views-update-input').val(maxViews);
      }).catch(function (err) {
        console.log(err.message);
      });
    });
  },

  handleUpdateBtnClick: function (e) {
    e.preventDefault();
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      const account = accounts[0];

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;

        const feeRate = web3.toWei($('#fee-rate-update-input').val(), 'ether');
        const maxViews = $('#max-views-update-input').val();

        return sponsorInstance.updateDetails(feeRate, maxViews, { from: account });
      }).then(function (res) {
        M.toast({ html: 'Updated Successfully!' });
      }).catch(function (err) {
        console.log(err.message);
      });

    });
  },


  // Form submit handlers
  handleRegistrationFormSubmit: function (e) {
    e.preventDefault();
    const channelName = $('#channel-name-input').val();
    const contact = $('#contact-input').val();
    const feeRate = $('#fee-rate-input').val();
    const maxViews = $('#max-views-input').val();

    if (channelName == "" || contact == "" || feeRate <= 0 || maxViews < 1) {
      M.toast({ html: 'Please enter all fields!' })
      return;
    }

    App.getChannel(channelName).then(response => {
      if (response.result.items[0].snippet === undefined) {
        throw "channel not found";
      }
      App.registerCreator(channelName, contact, feeRate, maxViews);
    })
      .catch(err => M.toast({ html: 'No channel by that name' }));
  },

  handleChannelFormSubmit: function (e) {
    e.preventDefault();
    const channelInput = $('#channel-input').val();

    App.getChannel(channelInput).then(response => {
      const channel = response.result.items[0];
      if (response.result.items[0].snippet === undefined) {
        throw "channel not found";
      }
      App.currentChannel = channelInput;
      App.setRightPanelChannel(channel);
    })
      .catch(err => M.toast({ html: 'No channel by that name' }));
  },

  handlePaymentFormSubmit: function (e) {
    e.preventDefault();
    const videoId = $('#current-video-id').html();
    const views = parseInt($('#current-video-views').html().replace(",", ""));
    const amount = $('#payment-amount-input').val();
    if (amount <= 0) {
      M.toast({ html: 'Please enter an amount' });
      return;
    }
    console.log(videoId, App.currentChannel, views, amount);
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      const account = accounts[0];

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.makeDeposit(videoId, App.currentChannel, views, {
          from: account, value: web3.toWei(amount, 'ether')
        });
      }).then(function (result) {
        M.toast({ html: 'Payment Deposited Successfully!' });
        console.log(result);
        const msg = $('#email-message').val()
          + "\nBlockHash: " + result.receipt.blockHash
          + "\nTransactionHash" + result.tx;
        console.log(msg);
        const mailToURL = 'mailto:' + App.currentChannelCreatorContact + '?subject=' + result.tx + '&body=' + msg;
        window.open(mailToURL);
        $('#payment-form')[0].reset();

        // Update UI if successful
        App.getChannel(App.currentChannel).then(response => {
          const channel = response.result.items[0];
          App.setRightPanelChannel(channel);
        })
          .catch(err => console.log(err));

        $('.modal').modal('close');

      }).catch(function (err) {
        console.log(err.message);
      });

    });
  },


  // Add commas to number (helper)
  numberWithCommas: function (x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // register new creator
  registerCreator: function (channelName, contact, feeRate, maxViews) {
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      const account = accounts[0];

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.registerCreator(
          channelName, contact, web3.toWei(feeRate, 'ether'), maxViews, { from: account }
        );
      }).then(function (result) {
        return App.setMyChannelPanel();
      }).catch(function (err) {
        console.log(err.message);
      });
    });
  },

  // Sets "My Channel" panel if creator is registered
  setMyChannelPanel: function () {
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      const account = accounts[0];

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.getRegisteredChannelName({ from: account });
      }).then(function (channelName) {
        App.myChannel = channelName;
        registrationForm.style.display = 'none';
        myChannelPanel.style.display = 'block';
        return App.displayMyChannel(channelName);
      }).catch(function (err) {
        console.log(err.message);
        registrationForm.style.display = 'block';
        myChannelPanel.style.display = 'none';
      });
    });
  },

  displayMyChannel: function (channelName) {
    App.getChannel(channelName).then(response => {
      const channel = response.result.items[0];
      const playlistId = channel.contentDetails.relatedPlaylists.uploads;

      const output = `
        <div class="my-channel-header">
          <h4 class="center-align">My Channel</h4>
          <span>Title: <span class="channel-details">${channel.snippet.title}</span></span>
          <a target="_blank" href="https://youtube.com/${channel.snippet.customUrl}">(Visit Channel)</a>
          <a id="update-details-btn" href="#update-details-modal"
           class="modal-trigger grey darken-2 waves-effect waves-light btn-small right">
            Update Details
          </a>
          <br>
          <span>Subscribers: <span class="my-channel-details">
          ${App.numberWithCommas(channel.statistics.subscriberCount)}
          </span></span>
          <span>Views: <span class="my-channel-details">
          ${App.numberWithCommas(channel.statistics.viewCount)}
          </span></span>
          <span>Videos: <span class="my-channel-details">
          ${App.numberWithCommas(channel.statistics.videoCount)}
          </span>
        </div>
        <ul id="my-videos" class="collection"></ul>      
        `;

      $('#my-channel').html(output);
      App.displayMyVideos(playlistId);
    })
      .catch(err => console.log(err));
  },

  displayMyVideos: function (playlistId) {
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
        // Loop through videos and append output
        playListItems.forEach(item => {
          const videoId = item.snippet.resourceId.videoId;
          const title = item.snippet.title;
          const options = {
            id: videoId,
            part: 'statistics'
          }

          const req = gapi.client.youtube.videos.list(options);
          let views;
          req.execute(res => {
            views = res.items[0].statistics.viewCount;
            const videoOutput = `
            <li class="collection-item">
              <div>
                <span>Title: <span class="my-channel-details">${title}</span></span><br>
                <span>Views: <span class="my-views-details">${views}</span></span>
            `;

            web3.eth.getAccounts(function (error, accounts) {
              if (error) {
                console.log(error);
              }

              const account = accounts[0];

              App.contracts.Sponsor.deployed().then(function (instance) {
                sponsorInstance = instance;
                return sponsorInstance.getVideoState(videoId, { from: account });
              }).then(function (state) {
                const sponsoredVideoOutput = `
                    <a id="${videoId}" class="grey darken-2 waves-effect waves-light 
                    btn-small secondary-content cancel-btn cancel-payment-btn">Cancel</a>
                    <a id="${videoId}" title="${views}" class="red waves-effect waves-light btn-small
                    secondary-content claim-payment-btn">Claim Payment</a>
                    <br><br>
                  </div>
                </li>
                `;
                const unsponsoredVideoOutput = `
                  </div>
                </li>
                `;

                $('#my-videos').append(
                  videoOutput + (state == "SPONSORED" ? sponsoredVideoOutput : unsponsoredVideoOutput)
                );

              }).catch(function (err) {
                console.log(err.message);
              });
            });

          });

        });
      } else {
        $('#my-videos').html('No Uploaded Videos');
      }
    });
  },

  // Get channel from API
  getChannel: function (channel) {
    return gapi.client.youtube.channels
      .list({
        part: 'snippet,contentDetails,statistics',
        forUsername: channel
      });
  },

  setRightPanelChannel: function (channel) {
    const output = `
    <span>Title: <span class="channel-details">
    ${channel.snippet.title}
    </span></span>
    <a target="_blank" href="https://youtube.com/${channel.snippet.customUrl}">(Visit Channel)</a>
    <br>
    <span>Subscribers: <span class="channel-details">
    ${App.numberWithCommas(channel.statistics.subscriberCount)}
    </span></span>
    <span>Views: <span class="channel-details">
    ${App.numberWithCommas(channel.statistics.viewCount)}
    </span></span>
    <span>Videos: <span class="channel-details">
    ${App.numberWithCommas(channel.statistics.videoCount)}
    </span></span>        
`;
    $('#channel-data').html(output);

    const playlistId = channel.contentDetails.relatedPlaylists.uploads;
    App.setCurrentChannelDetails();
    App.requestVideoPlaylist(playlistId);
  },

  setCurrentChannelDetails: function () {
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      const account = accounts[0];

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.getFeeRate(App.currentChannel, { from: account });
      }).then(function (feeRate) {
        App.currentChannelFeeRate = web3.fromWei(feeRate, 'ether');
      }).catch(function (err) {
        console.log(err.message);
      });

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.getMaxViewsPerWeek(App.currentChannel, { from: account });
      }).then(function (maxViews) {
        App.currentChannelMaxViews = maxViews;
      }).catch(function (err) {
        console.log(err.message);
      });

      App.contracts.Sponsor.deployed().then(function (instance) {
        sponsorInstance = instance;
        return sponsorInstance.getContact(App.currentChannel, { from: account });
      }).then(function (contact) {
        App.currentChannelCreatorContact = contact;
      }).catch(function (err) {
        console.log(err.message);
      });

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
      <iframe width="100%" height="auto" src="https://www.youtube.com/embed/${videoId}"
       frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
      <span class="views">views: ${App.numberWithCommas(viewsCount)}</span>
      `;

      web3.eth.getAccounts(function (error, accounts) {
        if (error) {
          console.log(error);
        }

        const account = accounts[0];

        App.contracts.Sponsor.deployed().then(function (instance) {
          sponsorInstance = instance;
          return sponsorInstance.getVideoState(videoId, { from: account });
        }).then(function (state) {
          const disabled = ((state == "SPONSORED") ? "disabled" : "");

          const sponsorBtnOutput = `
          <a id="${videoId}" title="${title}" 
          class="${disabled} sponsor-btn modal-trigger red waves-effect waves-light btn-small right" 
          href="#payment-modal">Sponsor</a>
          </div>
          `;
          const cancelBtnOutput = `
          <a id="${videoId}" title="${title}" class="cancel-payment-btn right" href="#">Cancel payment</a>
          <a id="${videoId}" title="${viewsCount}" class="claim-payment-btn right" href="#">Claim Refund</a>
          </div>
          `;

          $('#video-container')[0].innerHTML += (
            videoOutput + (state == "SPONSORED_BY_ME" ? cancelBtnOutput : sponsorBtnOutput)
          );

        }).catch(function (err) {
          console.log(err.message);
        });
      });

    });
  },

};

$(function () {
  $(window).load(function () {
    App.init();
  });
});