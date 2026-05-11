# Getting Started with Glee Backend

this repository contains the source code for the Glee Backend. build with node:20

## Prerequisites

-   Node.js (v20.x)
-   Yarn (v1.x)
-   Docker (v24.x)
-   NestJS CLI (v10.x)

## Installation

1. Clone the repository:

    ```bash
    git clone https://username@bitbucket.org/KoderLabs/glee-be.git
    ```

    change the username to your bitbucket username

2. Install NestJS CLI:

    ```bash
    yarn global add @nestjs/cli
    ```

3. change the branch to the production branch:

    ```bash
    git checkout release/production
    ```

4. Install dependencies:

    ```bash
    yarn install
    ```

5. Build the project:

    ```bash
    yarn build
    ```

## Running the project

```bash
yarn start
```

## Running the project in production

```bash
yarn start:prod
```

## Running the project in development watch mode

```bash
yarn start:dev
```

## Environment Variables

The project uses environment variables to configure the application. The environment variables are stored in the `.env` file.
Change the existing `.env.example` file to the desired environment and rename it to `.env`.

## Bitbucket Pipeline

The project uses bitbucket pipeline to deploy the application to the production server.
The pipeline is defined in the `bitbucket-pipeline.yml` file.

when you push to the production branch, the pipeline will deploy the application to the production server.

### Note:

1. In the pipeline `docker compose up` command is commented, because the production server already has the docker container running.
2. In the pipeline `pm2 start npm --name "GLEE-API" -- run start` command is commented, because the production server already has the pm2 process running.
