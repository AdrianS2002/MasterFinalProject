# BRIGHT blockchain-api

# Start Blockchain  chain

Using the folder provided, the steps to run deploy contracts from truffle to parity are:

1. Inside parity run

```bash
openethereum --config config.dev.toml --unlock 0x727d94033a8e61a8911ff9d84ae72222565eab06 --password pass.txt
```

2. Install dependencies inside the project

```bash
npm install
```

3. Install the truffle globally using:

```bash
npm install -g truffle
```

4. Inside the project run ( consider also deleting the complied contracts from build/contracts)

```bash
truffle compile --reset
```

5. Migrate Libraries

```bash
truffle migrate --network parity
```


# FinalProjectUni
# MasterFinalProject
