// Allows us to use ES6 in our migrations and tests.
//nu se mai foloseste
require('babel-register')

module.exports = {
  compilers: {
    solc:{
      version: '^0.7.4'
    }
  },
  
  networks: {
    parity: {
        host: '127.0.0.1',
        port: 8540,
        network_id: '35',
        from: '0x727d94033a8e61a8911ff9d84ae72222565eab06',
        gas: 0xffffffff
    },
  }
}
