pragma solidity ^0.5.0;

contract Sponsor {
    address payable public owner;
    
    // uint penalty = 10000000000;
    
    uint public numberOfCreators;
    address payable[] public creators;

    struct Creator {
        string channelName;
        string contact;
        uint feeRate;
        uint maxViewsPerWeek;
    }
    
    struct Payment {
        address payable sender;
        address payable receiver;
        uint amount;
        uint paymentDate;
        uint viewsPaidFor;
        uint viewsAtStartDate;
        bool pending;
    }

    // mapping from channelName to creater info
    mapping(address => Creator) private creatorInfo;
    // mapping from channel name to address
    mapping(string => address payable) private channelToAddress;
    // mapping from paymentId to payment info
    mapping(string => Payment) private payments;
    
    
    constructor() public {
        owner = msg.sender;
    }
    
    function kill() public {
        if(msg.sender == owner) selfdestruct(owner);
    }
    

    // utility function to convert string to bytes32
    function stringToBytes32 (string memory source) private pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            result := mload(add(source, 32))
        }
    }
    
    // getter for address of channel owner using channel name
    function getAddress(string memory channelName) public view returns (address) {
        return channelToAddress[channelName];
    }
    
    // returns true if the creator of given channelname is registered
    function creatorRegistered(address creatorAddress) view public returns (bool) {
        return creatorInfo[creatorAddress].feeRate > 0;
    }

    function channelRegistered(string memory channelName) public view returns (bool) {
        return channelToAddress[channelName] != address(0x0);
    }

    // get registered channelname of current user
    function getRegisteredChannelName() view public returns (string memory){
        require(creatorRegistered(msg.sender));
        return creatorInfo[msg.sender].channelName;
    }
    
    
    // register new creator    
    function registerCreator(string memory channelName, string memory contact, uint feeRate, uint maxViewsPerWeek) public {
        address payable creatorAddress = msg.sender;
        require(!creatorRegistered(creatorAddress));
        
        creatorInfo[creatorAddress].channelName = channelName;
        channelToAddress[channelName] = creatorAddress;
        creatorInfo[creatorAddress].contact = contact;
        creatorInfo[creatorAddress].feeRate = feeRate;
        creatorInfo[creatorAddress].maxViewsPerWeek = maxViewsPerWeek;
        numberOfCreators++;
        creators.push(creatorAddress);
    }
    
    
    // getters for payment
    function getFeeRate(string memory channelName) public view returns (uint) {
        return creatorInfo[channelToAddress[channelName]].feeRate;
    }
    
    function getMaxViewsPerWeek(string memory channelName) public view returns (uint) {
        return creatorInfo[channelToAddress[channelName]].maxViewsPerWeek;
    }
    
    function getContact(string memory channelName) public view returns (string memory) {
        return creatorInfo[channelToAddress[channelName]].contact;
    }
    
    // update fee rate and max view per weeks count
    function updateDetails(uint feeRate, uint maxViewsPerWeek) public {
        require(creatorRegistered(msg.sender));
        creatorInfo[msg.sender].feeRate = feeRate;
        creatorInfo[msg.sender].maxViewsPerWeek = maxViewsPerWeek;
    }
    
    

    // get video state
    function getVideoState(string memory videoId) public view returns (string memory){
        string memory state;

        if((payments[videoId].sender == msg.sender) && payments[videoId].pending){
            state = "SPONSORED_BY_ME";
        }
        else if((payments[videoId].amount > 0) && payments[videoId].pending){
            state = "SPONSORED";
        }
        else {
            state = "UNSPONSORED";
        }
        return state; 
    }
    
    

    // for sponsor to make a deposit into the contract for promotion
    // the creator must be registered & demanded views must be less than max
    function makeDeposit(string memory videoId, string memory channelName, uint viewsAtStartDate) public payable {
        require(!payments[videoId].pending);
        address payable creatorAddress = channelToAddress[channelName];
        require(creatorRegistered(creatorAddress));
        require(msg.sender != creatorAddress);        
        require(msg.value > 0);
        uint viewsPaidFor = (msg.value / (creatorInfo[creatorAddress].feeRate));
        require(viewsPaidFor < creatorInfo[creatorAddress].maxViewsPerWeek);        
        
        payments[videoId].sender = msg.sender;
        payments[videoId].receiver = creatorAddress;
        payments[videoId].amount = msg.value;
        payments[videoId].paymentDate = now;
        payments[videoId].viewsPaidFor = viewsPaidFor;
        payments[videoId].viewsAtStartDate = viewsAtStartDate;
        payments[videoId].pending = true;
    }
    
    
    // sponsor can cancel payment within 2 days if requirements are not met by creator
    // creator can cancel any time
    function cancelPayment(string memory videoId) public {
        require((payments[videoId].amount > 0) && payments[videoId].pending);
        
        address payable sender = payments[videoId].sender;
        address payable receiver = payments[videoId].receiver;
        uint amount = payments[videoId].amount;
        uint paymentDate = payments[videoId].paymentDate;
        
        require((msg.sender == receiver) || ((msg.sender == sender) && (now <= (paymentDate + 2 * 1 days))));
        
        payments[videoId].pending = false;
        sender.transfer(amount);
        
    }        
    
    
    // sponsor or creator can claim payment
    function makeWithdrawal(string memory videoId, uint currentViews) public {
        require(payments[videoId].pending);
        address payable receiver = payments[videoId].receiver;
        address payable sender = payments[videoId].sender;
        require((msg.sender == sender) || (msg.sender == receiver));
        uint amount = payments[videoId].amount;
        uint paymentDate = payments[videoId].paymentDate;

        // creator can claim payment if view goal is reached
        if((msg.sender == receiver)
            && ((currentViews - payments[videoId].viewsAtStartDate) >= payments[videoId].viewsPaidFor)){
            receiver.transfer(amount);
            payments[videoId].pending = false;
        }        
        
        // sponsor can claim refund if 1 week has passed
        else if((msg.sender == sender) && (now > (paymentDate + 1 weeks))){
            if((currentViews - payments[videoId].viewsAtStartDate) < payments[videoId].viewsPaidFor){
                // sender.transfer(penalty);
                sender.transfer(amount);    
            }
            else{
                // receiver.transfer(amount-penalty);
                receiver.transfer(amount);   
            }
            payments[videoId].pending = false;
        }
    }
}
