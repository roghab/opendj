import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events, MenuController, Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { UserDataService } from './providers/user-data.service';
import { UserSessionState } from './models/usersessionstate';
import { ConfigService } from './providers/config.service';
import { HttpClient } from '@angular/common/http';
import { retry, catchError, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {

  // userState is important for displaying the menu options
  userState = new UserSessionState();

  constructor(
    public platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private events: Events,
    private router: Router,
    private menu: MenuController,
    private userDataService: UserDataService,
    private confService: ConfigService,
    private http: HttpClient
  ) {
    this.initializeApp();
    this.registerEventSubscribers();
  }

  initializeApp() {
    this.platform.ready().then((readySource) => {
      console.debug(`Running on Platform: ${readySource}`);

      if (readySource === 'cordova') {
        this.statusBar.styleDefault();
        this.splashScreen.hide();
      }
    });
  }

  private async loadUserState() {
    console.debug('loadUserState');
    this.userState = await this.userDataService.getUser();
  }

  serverSideLogout(user: UserSessionState) {
    if (user &&  user.currentEventID ) {
      const url = this.confService.WEB_PROVIDER_API
      + '/events/' + user.currentEventID + '/user/logout';
      const body = { userState: user };

      console.debug('before post url=%s, body=%s', url, JSON.stringify(body));
      this.http.post(url, body)
          .pipe(
          timeout(this.confService.SERVER_TIMEOUT),
          retry(1)
          ).subscribe();
    }
  }


  registerEventSubscribers() {
    console.debug('registerEventSubscribers');

    this.events.subscribe('sessionState:modified', state => {
      console.debug('Received sessionState:modified event');
      this.userState = state;
      this.userDataService.updateUser(state);
    });

    this.events.subscribe('user:logout', data => {
      console.debug('Received user:logout event', data);
      let redirectUrl;
      if ( data && data.redirect ) {
        redirectUrl = data.redirect;
      } else {
        redirectUrl = 'ui/event/' + this.userState.currentEventID;
      }

      this.serverSideLogout(this.userState);

      this.userState = new UserSessionState();
      this.userDataService.updateUser(this.userState);
      this.router.navigate([redirectUrl]);
    });

    this.userDataService.events.subscribe('user:modified', data => {
      console.debug('Received user:modified event from user data service');
      this.userState = data;
    });

  }


  logout() {
    this.events.publish('user:logout');
  }

  home() {
    this.events.publish('user:logout', {redirect: 'ui/landing'});
  }


  async ngOnInit() {
    console.debug('ngOnInit()');
    await this.loadUserState();
  }

}
