import { UserDataService } from './../../providers/user-data.service';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ModalController, ActionSheetController, ToastController, Platform, IonSearchbar } from '@ionic/angular';
import { WebsocketService } from 'src/app/providers/websocket.service';
import { MockService } from 'src/app/providers/mock.service';
import { FEService } from './../../providers/fes.service';
import { Track } from 'src/app/models/track';
import { Playlist } from 'src/app/models/playlist';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-playlist',
  templateUrl: 'playlist.page.html',
  styleUrls: ['playlist.page.scss']
})
export class PlaylistPage implements OnInit, OnDestroy {
  public selectedItem: any;

  currentPlaylist: Playlist = null;
  subscriptions: Subscription[] = [];
  username: string = null;
  isCurator = false;
  showOptions = false;

  constructor(
    public modalController: ModalController,
    public actionSheetController: ActionSheetController,
    public toastController: ToastController,
    public websocketService: WebsocketService,
    public mockService: MockService,
    public feService: FEService,
    public userDataService: UserDataService,
    public platform: Platform
  ) {
  }

  playTrack() {
    this.feService.playTrack().subscribe((data) => {
      // console.log(data);
    },
    (err) => {
      console.log(err.msg);
    });
  }

  deleteTrack(track, index) {
    this.feService.deleteTrack(track.id, index).subscribe(
      res => {
        // console.log(res);
        this.presentToast('You have deleted the track.');
      },
      err => console.log(err)
    );
  }

  refresh(event) {
    this.websocketService.refreshPlaylist();
    setTimeout(() => {
      event.detail.complete();
    }, 1000);
  }

  date2hhmm(d) {
    d = d.toTimeString().split(' ')[0];
    return d.substring(0, 5);
  }

  computeETAForTracks(playlist) {
    console.log('computeETAForTracks');
    let ts = Date.now();
    if (playlist.currentTrack) {
        ts += (playlist.currentTrack.duration_ms - playlist.currentTrack.progress_ms);
    }
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < playlist.nextTracks.length; i++) {
        playlist.nextTracks[i].eta = this.date2hhmm(new Date(ts));
        ts += playlist.nextTracks[i].duration_ms;
    }
  }

  onRenderItems(event) {
    // console.log(`Moving item from ${event.detail.from} to ${event.detail.to}`);
    const draggedItem = this.currentPlaylist.nextTracks.splice(event.detail.from, 1)[0];
    this.currentPlaylist.nextTracks.splice(event.detail.to, 0, draggedItem);
    this.feService.reorderTrack(draggedItem.id, event.detail.from, event.detail.to).subscribe(
      data => {
        this.presentToast('Track successfully reordered in playlist.');
      },
      err => console.log(err)
    );
    event.detail.complete();
  }

  toggleOptions() {
    if (this.showOptions) {
      this.showOptions = false;
    } else {
      this.showOptions = true;
    }
  }

  moveTop(item, index, slidingItem) {
    if (this.isCurator) {
      this.feService.reorderTrack(item.id, index, 0).subscribe(
        data => {
          this.presentToast('Track moved to top.');
          // slidingItem.close();
        },
        err => console.log(err)
      );
    }
  }

  async presentModal() {
    const modal = await this.modalController.create({
      component: PlaylistAddModalComponent,
      componentProps: { value: 123 }
    });
    modal.onDidDismiss().then(res => {
      if (res.data) {
        this.feService.addTrack(res.data.id, 'spotify', this.username).subscribe(
          data => {
            this.presentToast('Track added to playlist.');
          },
          err => console.log(err)
        );
      }
    });
    return await modal.present();
  }

  async presentToast(data) {
    const toast = await this.toastController.create({
      message: data,
      position: 'top',
      color: 'light',
      duration: 2000
    });
    toast.present();
  }

  async presentActionSheet(data, index) {
    const actionSheet = await this.actionSheetController.create({
      header: data.title,
      buttons: [
        {
          text: 'Play (preview mode)',
          icon: 'arrow-dropright-circle',
          handler: () => {
            console.log('Play clicked');
          }
        },
        {
          text: 'Delete',
          role: 'destructive',
          icon: 'trash',
          handler: () => {
            console.log('Delete clicked');
            this.feService.deleteTrack(data.id, index).subscribe(
              res => {
                console.log(res);
                this.presentToast('You have deleted the track.');
              },
              err => console.log(err)
            );
          }
        }, {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel',
          handler: () => {
            console.log('Cancel clicked');
          }
        }]
    });
    if (this.isCurator) {
      await actionSheet.present();
    }

  }

  trackElement(index: number, element: any) {
    // return element ? element.id : null;
    // tslint:disable-next-line:no-unused-expression
    return index + ', ' + element.id;
  }

  ionViewDidEnter() {
    console.log('Playlist page enter');
    setTimeout(() => {
      if (!this.websocketService.isConnected) {
        this.websocketService.init();
      }
      this.websocketService.refreshPlaylist();
    }, 500);

    this.userDataService.getUsername().then(data =>
      this.username = data
    );
    this.userDataService.getCurator().then(data =>
      this.isCurator = data
    );
  }

  ionViewDidLeave() {
    console.log('Playlist page leave');
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  ngOnInit() {
    console.log('Playlist page init');
    this.websocketService.init();

    const sub: Subscription = this.websocketService.getPlaylist().subscribe(data => {
      this.currentPlaylist = data as Playlist;
      if (this.currentPlaylist.hasOwnProperty('nextTracks')) {
        this.computeETAForTracks(this.currentPlaylist);
      }
      console.log(`playlist subscription: `, this.currentPlaylist);
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy() {
  }

}


/**
 * Add to playlist modal
 * Search for songs and add to current playlist.
 */
@Component({
  selector: 'app-playlist-add-modal',
  template: `
  <ion-header>
  <ion-toolbar color="dark">
    <ion-buttons slot="start">
      <ion-button (click)="dismiss(null)">
        <ion-icon slot="icon-only" name="close"></ion-icon>
      </ion-button>
    </ion-buttons>
    <ion-title>Add song to playlist</ion-title>
  </ion-toolbar>
  <ion-toolbar color="dark">
    <ion-searchbar  [(ngModel)]="queryText" (ionChange)="updateSearch()" placeholder="Search for songs..." #myInput>
    </ion-searchbar>
  </ion-toolbar>
</ion-header>

<ion-content color="light">

  <ion-list color="light">

    <ion-item color="light" *ngFor="let item of tracks">
      <ion-thumbnail slot="start">
        <img src="{{item.image_url}}">
      </ion-thumbnail>
      <ion-label text-wrap>{{item.name}}<br />
        <span style="font-size: 14px; color: #666;">{{item.artist}}, {{item.year}}</span><br />
      </ion-label>
      <p>
        <ion-button (click)="dismiss(item)">Add</ion-button>
      </p>
    </ion-item>

    </ion-list>

</ion-content>
  `
})
export class PlaylistAddModalComponent implements OnInit {
  queryText = '';
  tracks: Array<Track>;
  @ViewChild(IonSearchbar) myInput: IonSearchbar;

  setFocus() {
    this.myInput.setFocus();
  }

  constructor(
    public modalController: ModalController,
    public feService: FEService) { }


  dismiss(data) {
    this.modalController.dismiss(data);
  }

  updateSearch() {
    this.feService.searchTracks(this.queryText).subscribe(
      data => {
        this.tracks = data;
      },
      err => console.log(err));
  }

  ngOnInit() {
    setTimeout(() => {
      this.setFocus();
    }, 150);
  }
}
