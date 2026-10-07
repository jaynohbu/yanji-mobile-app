# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## iOS release version

The iOS, Expo, and npm package version is **1.0.4**.
Keep `app.json`, the iOS `Info.plist`, Xcode `MARKETING_VERSION`, and package
metadata in sync when updating the release version. Production EAS builds manage
and increment the build number remotely.

Run `npm run deploy-ios` to build the production iOS app and automatically schedule
its submission to App Store Connect. EAS and Apple credentials must already be
configured for non-interactive builds and submissions. Check the EAS submission
status before expecting the build in TestFlight; public release still requires
App Store review.

Demo login credentials are not stored in the checked-in app configuration.
Local development can supply them through `.env.local` and the development setup
script. `.easignore` excludes local environment files, logs, and documentation
from build uploads. Do not deploy an `app.json` rewritten with development
settings or credentials.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
