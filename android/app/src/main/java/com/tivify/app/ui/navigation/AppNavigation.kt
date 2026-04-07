package com.tivify.app.ui.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.tivify.app.ui.AppViewModel
import com.tivify.app.ui.channels.ChannelsScreen
import com.tivify.app.ui.epg.EpgScreen
import com.tivify.app.ui.favorites.FavoritesScreen
import com.tivify.app.ui.history.HistoryScreen
import com.tivify.app.ui.home.HomeScreen
import com.tivify.app.ui.login.LoginScreen
import com.tivify.app.ui.player.PlayerScreen
import com.tivify.app.ui.help.HelpScreen
import com.tivify.app.ui.about.AboutScreen
import com.tivify.app.ui.profile.ProfileScreen
import com.tivify.app.ui.series.SeriesDetailScreen
import com.tivify.app.ui.series.SeriesScreen
import com.tivify.app.ui.splash.SplashScreen
import com.tivify.app.ui.theme.*
import com.tivify.app.ui.vod.VodDetailScreen
import com.tivify.app.ui.vod.VodScreen

sealed class Screen(val route: String) {
    data object Splash : Screen("splash")
    data object Login : Screen("login")
    data object Home : Screen("home")
    data object Channels : Screen("channels")
    data object Vod : Screen("vod")
    data object VodDetail : Screen("vod_detail/{id}") {
        fun createRoute(id: Int) = "vod_detail/$id"
    }
    data object Series : Screen("series")
    data object SeriesDetail : Screen("series_detail/{id}") {
        fun createRoute(id: Int) = "series_detail/$id"
    }
    data object Player : Screen("player/{type}/{id}") {
        fun createRoute(type: String, id: Int) = "player/$type/$id"
    }
    data object Favorites : Screen("favorites")
    data object History : Screen("history")
    data object Epg : Screen("epg")
    data object Profile : Screen("profile")
    data object Help : Screen("help")
    data object About : Screen("about")
}

data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Home, "Inicio", Icons.Default.Home),
    BottomNavItem(Screen.Channels, "Canales", Icons.Default.LiveTv),
    BottomNavItem(Screen.Vod, "Peliculas", Icons.Default.Movie),
    BottomNavItem(Screen.Series, "Series", Icons.Default.VideoLibrary),
    BottomNavItem(Screen.Profile, "Perfil", Icons.Default.Person),
)

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val appViewModel: AppViewModel = hiltViewModel()

    // Navigate to login when the session expires mid-use (401 intercepted)
    LaunchedEffect(Unit) {
        appViewModel.unauthorizedEvent.collect {
            if (navController.currentDestination?.route != Screen.Login.route) {
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    val hideBottomBar = currentRoute in listOf(
        Screen.Splash.route,
        Screen.Login.route,
        Screen.Player.route,
        Screen.Help.route,
        Screen.About.route,
        Screen.Epg.route
    )

    Scaffold(
        containerColor = DarkBackground,
        bottomBar = {
            if (!hideBottomBar) {
                NavigationBar(
                    containerColor = DarkSurface,
                    contentColor = TextSecondary
                ) {
                    bottomNavItems.forEach { item ->
                        val selected = currentRoute == item.screen.route
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                Icon(item.icon, contentDescription = item.label)
                            },
                            label = { Text(item.label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Primary500,
                                selectedTextColor = Primary500,
                                unselectedIconColor = TextMuted,
                                unselectedTextColor = TextMuted,
                                indicatorColor = Primary500.copy(alpha = 0.15f)
                            )
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = Screen.Splash.route,
            modifier = Modifier.padding(paddingValues),
            enterTransition = {
                fadeIn(tween(220)) + slideInHorizontally(tween(220)) { it / 8 }
            },
            exitTransition = {
                fadeOut(tween(180)) + slideOutHorizontally(tween(180)) { -it / 8 }
            },
            popEnterTransition = {
                fadeIn(tween(220)) + slideInHorizontally(tween(220)) { -it / 8 }
            },
            popExitTransition = {
                fadeOut(tween(180)) + slideOutHorizontally(tween(180)) { it / 8 }
            }
        ) {
            composable(
                route = Screen.Splash.route,
                enterTransition = { fadeIn(tween(300)) },
                exitTransition = { fadeOut(tween(300)) }
            ) {
                SplashScreen(
                    onFinished = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Splash.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Home.route) {
                HomeScreen(
                    onChannelClick = { id ->
                        navController.navigate(Screen.Player.createRoute("channel", id))
                    },
                    onVodClick = { id ->
                        navController.navigate(Screen.VodDetail.createRoute(id))
                    },
                    onSeriesClick = { id ->
                        navController.navigate(Screen.SeriesDetail.createRoute(id))
                    }
                )
            }

            composable(Screen.Channels.route) {
                ChannelsScreen(
                    onChannelClick = { id ->
                        navController.navigate(Screen.Player.createRoute("channel", id))
                    }
                )
            }

            composable(Screen.Vod.route) {
                VodScreen(
                    onVodClick = { id ->
                        navController.navigate(Screen.VodDetail.createRoute(id))
                    }
                )
            }

            composable(
                route = Screen.VodDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.IntType })
            ) { entry ->
                val id = entry.arguments?.getInt("id") ?: return@composable
                VodDetailScreen(
                    vodId = id,
                    onPlay = { navController.navigate(Screen.Player.createRoute("vod", id)) },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Series.route) {
                SeriesScreen(
                    onSeriesClick = { id ->
                        navController.navigate(Screen.SeriesDetail.createRoute(id))
                    }
                )
            }

            composable(
                route = Screen.SeriesDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.IntType })
            ) { entry ->
                val id = entry.arguments?.getInt("id") ?: return@composable
                SeriesDetailScreen(
                    seriesId = id,
                    onEpisodePlay = { vodId ->
                        navController.navigate(Screen.Player.createRoute("vod", vodId))
                    },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Screen.Player.route,
                arguments = listOf(
                    navArgument("type") { type = NavType.StringType },
                    navArgument("id") { type = NavType.IntType }
                )
            ) { entry ->
                val type = entry.arguments?.getString("type") ?: return@composable
                val id = entry.arguments?.getInt("id") ?: return@composable
                PlayerScreen(
                    contentType = type,
                    contentId = id,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Favorites.route) {
                FavoritesScreen(
                    onChannelClick = { id ->
                        navController.navigate(Screen.Player.createRoute("channel", id))
                    },
                    onVodClick = { id ->
                        navController.navigate(Screen.VodDetail.createRoute(id))
                    },
                    onSeriesClick = { id ->
                        navController.navigate(Screen.SeriesDetail.createRoute(id))
                    },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.History.route) {
                HistoryScreen(
                    onChannelClick = { id ->
                        navController.navigate(Screen.Player.createRoute("channel", id))
                    },
                    onVodClick = { id ->
                        navController.navigate(Screen.VodDetail.createRoute(id))
                    },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Epg.route) {
                EpgScreen(onBack = { navController.popBackStack() })
            }

            composable(Screen.Profile.route) {
                ProfileScreen(
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onFavoritesClick = { navController.navigate(Screen.Favorites.route) },
                    onHistoryClick = { navController.navigate(Screen.History.route) },
                    onEpgClick = { navController.navigate(Screen.Epg.route) },
                    onHelpClick = { navController.navigate(Screen.Help.route) },
                    onAboutClick = { navController.navigate(Screen.About.route) }
                )
            }

            composable(Screen.Help.route) {
                HelpScreen(onBack = { navController.popBackStack() })
            }

            composable(Screen.About.route) {
                AboutScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}
