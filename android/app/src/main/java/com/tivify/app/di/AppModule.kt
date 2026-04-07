package com.tivify.app.di

import android.content.Context
import com.tivify.app.BuildConfig
import com.tivify.app.data.TokenManager
import com.tivify.app.data.api.AuthInterceptor
import com.tivify.app.data.api.BaseUrlInterceptor
import com.tivify.app.data.api.UnauthorizedInterceptor
import com.tivify.app.data.api.TivifyApi
import com.tivify.app.ui.components.ViewModePreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideTokenManager(@ApplicationContext context: Context): TokenManager {
        return TokenManager(context)
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        baseUrlInterceptor: BaseUrlInterceptor,
        unauthorizedInterceptor: UnauthorizedInterceptor
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            // Only log request/response body in debug builds; use NONE level in release
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        return OkHttpClient.Builder()
            .addInterceptor(baseUrlInterceptor)
            .addInterceptor(authInterceptor)
            .addInterceptor(unauthorizedInterceptor) // catches 401 mid-session
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("http://localhost/api/") // Placeholder, replaced by BaseUrlInterceptor
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideTivifyApi(retrofit: Retrofit): TivifyApi {
        return retrofit.create(TivifyApi::class.java)
    }

    @Provides
    @Singleton
    fun provideViewModePreferences(@ApplicationContext context: Context): ViewModePreferences {
        return ViewModePreferences(context)
    }
}
