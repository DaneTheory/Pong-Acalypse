var http = require('http')
  , static = require('node-static')
  , server;
    
var file = new(static.Server)('./public');

server = http.createServer(function(req, res){
  req.addListener('end', function () {
    file.serve(req, res);
  }).resume();
}).listen(8800);

var io = require('socket.io/lib/socket.io').listen(8080);
var buffer = [],
 	number_of_rooms = 5,
 	rooms = [];

for(var i = 0; i < number_of_rooms; i++) {
  rooms[i] = {count: 0, player_id_having_the_ball: 1};
}

function get_list_of_rooms() {
  var list_of_rooms = {number_of_rooms: number_of_rooms, rooms: []}
  for(var i = 0; i < number_of_rooms; i++) {
    var player1_country = rooms[i].player1_country || {};
    var player2_country = rooms[i].player2_country || {};
    list_of_rooms['rooms'].push({number_of_connected_players: rooms[i].count, player1_country: player1_country, player2_country: player2_country })
  }
  return list_of_rooms;
}

function find_room_and_disconnect_by_session_id(id) {
  for(var i = 0; i < number_of_rooms; i++) {
    var room = rooms[i];
    if(room.count > 0) {
      if(room.player1_id == id) {
        room.player1_id = null;
        room.count -= 1;
        break;
      } else if(room.player2_id == id) {
        room.player2_id = null;
        room.count -= 1;
        break;
      }
    }
  }
}

io.sockets.on('connection', function (socket) {
  socket.emit('list_of_rooms', get_list_of_rooms());  
  
  socket.on('disconnect', function () {
    if(socket.room_id != null) {
      rooms[socket.room_id].count -= 1;
      find_room_and_disconnect_by_session_id(socket.id);
      socket.leave('room#'+socket.room_id);
    }
    io.sockets.json.emit('list_of_rooms', get_list_of_rooms());
  });
  
  socket.on('round_started', function(msg) {
    io.sockets.in('room#'+msg.room_id).json.emit('round_started', msg);
  });
  
  socket.on('sync', function(msg) {
    io.sockets.in('room#'+msg.room_id).emit('sync', msg);
  });
  
  socket.on('end_of_the_round', function(msg) {
    rooms[msg.room_id].player_id_having_the_ball = (msg.player_won == 1 ? 2 : 1);
    io.sockets.in('room#'+msg.room_id).json.emit("end_of_the_round", {player_won: msg.player_won, player_id_having_the_ball: rooms[msg.room_id].player_id_having_the_ball, room_id: msg.room_id});
  });
        
  socket.on('connect', function(msg) {
    socket.join('room#' + msg.room_id);
    socket.room_id = msg.room_id;
    find_room_and_disconnect_by_session_id(socket.id);
    rooms[msg.room_id].count += 1;
    
    if(rooms[msg.room_id].count == 1) {
      rooms[msg.room_id].player1_country = {};
      rooms[msg.room_id].player1_id = socket.id;
      rooms[msg.room_id].player1_country['code'] = msg.country_code;
      rooms[msg.room_id].player1_country['name'] = msg.country_name;
    } else {
      rooms[msg.room_id].player2_country = {};
      rooms[msg.room_id].player2_id = socket.id;
      rooms[msg.room_id].player2_country['code'] = msg.country_code;
      rooms[msg.room_id].player2_country['name'] = msg.country_name;
    }
    
    if(rooms[msg.room_id].count == 1) {
      socket.json.emit('player_connected', {player_id: 1, room_id: msg.room_id, player1_country: rooms[msg.room_id].player1_country});
    } else if(rooms[msg.room_id].count == 2) {
      io.sockets.in('room#'+msg.room_id).json.emit('player_connected', {player_id: 2, room_id: msg.room_id, player1_country: rooms[msg.room_id].player1_country, player2_country: rooms[msg.room_id].player2_country});
      io.sockets.in('room#'+msg.room_id).json.emit('round_could_be_started', {room_id: socket.room_id});
    }
    
    io.sockets.json.emit('list_of_rooms', get_list_of_rooms());
  })
});