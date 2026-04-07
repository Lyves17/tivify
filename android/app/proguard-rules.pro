# ProGuard rules for Tivify app

# Keep Hilt-generated code
-keep class dagger.hilt.** { *; }
-keep class hilt_aggregated_deps.** { *; }

# Keep ViewModels for Hilt injection
-keep class * extends androidx.lifecycle.ViewModel {
    <init>(...);
}

# Keep Hilt modules
-keep class * implements dagger.Module { *; }
-keep class * implements dagger.hilt.InstallIn { *; }
-keep @dagger.hilt.** class * { *; }

# Keep Retrofit interfaces
-keep interface com.tivify.app.data.api.TivifyApi { *; }

# Keep data classes used for JSON parsing
-keep class com.tivify.app.data.** { *; }
-keep class com.tivify.app.data.api.** { *; }

# Keep Gson serialization
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.google.gson.stream.** { *; }

# Keep ExoPlayer
-keep class androidx.media3.** { *; }
-keep interface androidx.media3.** { *; }

# Keep Compose related classes
-keep class androidx.compose.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Disable some verbose logging in release builds
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
}
