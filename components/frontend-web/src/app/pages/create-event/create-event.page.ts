import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Events, ToastController, IonContent } from '@ionic/angular';
import { UserDataService } from '../../providers/user-data.service';
import { FormBuilder, FormGroup, Validators, FormControl, ValidatorFn, AbstractControl } from '@angular/forms';
import { MusicEvent } from 'src/app/models/music-event';
import { FEService } from 'src/app/providers/fes.service';
import { UserSessionState } from 'src/app/models/usersessionstate';
import { EventIdValidator } from 'src/app/validators/eventId-validator';

@Component({
  selector: 'app-create-event',
  templateUrl: './create-event.page.html',
  styleUrls: ['./create-event.page.scss'],
})
export class CreateEventPage implements OnInit {

  @ViewChild(IonContent) content: IonContent;
  eventForm: FormGroup;
  event = new MusicEvent();
  userState: UserSessionState;
  submitAttempt: boolean;
  isCreate: boolean;

  constructor(
    public router: Router,
    private events: Events,
    public userDataService: UserDataService,
    public feService: FEService,
    public formBuilder: FormBuilder,
    public toastController: ToastController
  ) { }

  create({ value, valid }: { value: any, valid: boolean }) {
    console.debug('create');
    console.debug(value);

    if (valid) {
      Object.assign(this.event, value);

      this.feService.createEvent(this.event).subscribe((event) => {
        console.debug('createEvent -> SUCCESS');
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);
        this.isCreate = false;

        this.userState = new UserSessionState();
        this.userState.username = event.owner;
        this.userState.currentEventID = this.event.eventID;
        this.userState.isEventOwner = true;
        this.userState.isCurator = true;
        this.userState.isLoggedIn = true;
        this.events.publish('sessionState:modified', this.userState);
        this.presentToast('You have successfully created this event. You have been also logged in as owner to this event.');
        this.content.scrollToTop();
      },
      (err) => {
        console.error('Calling server side create event...FAILED', err);
        this.presentToast('ERROR creating this event');
      });
    } else {
      console.debug('Form is not valid, ignoring create request');
      this.presentToast('Form is not valid! Please submit all required data.');
    }
  }

  update({ value, valid }: { value: any, valid: boolean }) {
    console.debug('update');
    if (valid) {
      Object.assign(this.event, value);

      this.feService.updateEvent(this.event).subscribe((event) => {
        console.debug('updateEvent -> SUCCESS');
        this.event = event;
        this.mapEventToForm(this.eventForm, this.event);
        this.isCreate = false;
        this.presentToast('You have successfully updated this event.');
        this.content.scrollToTop();
      },
      (err) => {
        console.error('Calling server side update event...FAILED', err);
        this.presentToast('ERROR updating this event');
      });
    } else {
      console.debug('Form is not valid, ignoring update request');
      this.presentToast('Form is not valid! Please submit all required data.');
    }
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

  mapEventToForm(f: FormGroup, e: MusicEvent) {
    f.patchValue(e);
  }

  async refreshState() {
    console.debug('refreshState');
    this.userState  = await this.userDataService.getUser();
    if (!this.userState.isLoggedIn) {
      this.isCreate = true;
      this.event = await this.feService.readEvent(null).toPromise();
    }
    if (this.userState.isLoggedIn && this.userState.isEventOwner) {
      this.isCreate = false;
      this.event = await this.feService.readEvent(this.userState.currentEventID).toPromise();
    }
    this.mapEventToForm(this.eventForm, this.event);
  }

  async ionViewDidEnter() {
    console.debug('ionViewDidEnter');
    await this.refreshState();
  }

  async ngOnInit() {
    console.debug('ngOnInit');
    this.eventForm = this.formBuilder.group({
      // TODO: add this async validator ->  EventIdValidator
      eventID: ['', Validators.compose([Validators.minLength(3), Validators.maxLength(12), Validators.pattern('[a-z0-9]*'), Validators.required]), null ],
      name: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      url: [''],
      maxUsers: [0, Validators.min(1)],
      owner: ['', Validators.required],
      passwordOwner: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      // ToDo: Only Required if everybodyIsCurator is false
      passwordCurator: ['', Validators.compose([Validators.minLength(3), Validators.required])],
      passwordUser: [''],
      maxDurationInMinutes: [0, Validators.min(10)],
      maxTracksInPlaylist: [0, Validators.min(2)],
      eventStartsAt: [new Date().toISOString(), Validators.required],
      eventEndsAt: [new Date().toISOString(), Validators.required],
      allowDuplicateTracks: [false],
      progressPercentageRequiredForEffectivePlaylist: [false],
      beginPlaybackAtEventStart: [false],
      everybodyIsCurator: [false],
      pauseOnPlayError: [false],
      enableTrackLiking: [false],
      enableTrackHating: [false],
      demoAutoskip: [''],
      demoNoActualPlaying: [false],
      demoAutoFillEmptyPlaylist: [false]
    });

  }

}