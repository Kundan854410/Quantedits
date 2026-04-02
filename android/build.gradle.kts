// Android build configuration for QuantneonCamera plugin
// This file should be merged into the main app-level build.gradle.kts
// when `npx cap add android` scaffolds the Android project.

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.quantedits.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.quantedits.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Capacitor
    implementation("com.capacitorjs:core:8.+")

    // CameraX for video recording
    val cameraXVersion = "1.4.1"
    implementation("androidx.camera:camera-core:$cameraXVersion")
    implementation("androidx.camera:camera-camera2:$cameraXVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraXVersion")
    implementation("androidx.camera:camera-video:$cameraXVersion")

    // Google ML Kit Face Detection (on-device, no cloud dependency)
    implementation("com.google.mlkit:face-detection:16.1.7")

    // AndroidX
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
