$(document).ready(function() {

    "use strict";
    var TimeLog = openerp.TimeLog = {};
    var audio = new Audio();
    var instance = openerp;

    TimeLog.Manager = openerp.Widget.extend({
        init: function (widget) {
            this._super();
            var self = this;
            this.stopline_audio_warning = true;
            this.stopline_audio_stop = true;
            this.widget = widget;

            this.channel = JSON.stringify([this.widget.dbname,"project.timelog",String(this.widget.uid)]);
            // start the polling
            this.bus = openerp.bus.bus;
            this.bus.add_channel(this.channel);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notification) {
            var self = this;
            if (typeof notification[0][0] === 'string') {
                notification = [notification];
            }
            for (var i = 0; i < notification.length; i++) {
                var channel = notification[i][0];
                var message = notification[i][1];
                this.on_notification_do(channel, message);
            }
        },
        on_notification_do: function (channel, message) {
            var self = this;
            var error = false;
            if (typeof channel != "string") {
                return false;
            }
            if (channel != this.channel) {
                return false;
            }
            channel = JSON.parse(channel);
            if (Array.isArray(channel) && channel[1] === 'project.timelog') {
                try {
                    this.received_message(message);
                } catch (err) {
                    error = err;
                    console.error(err);
                }
            }
        },
        received_message: function(message) {
            var self = this;
            if (message.status == "play") {
                this.widget.timelog_id = message.timelog_id;
                if (message.active_work_id == this.widget.work_id) {
                    this.widget.start_timer();
                } else {
                    this.widget.finish_status = false;
                    this.widget.load_timer_data();
                    this.widget.start_timer();
                }
                $('#clock0').css('color','white');
            }
            if (message.status == "stop") {
                this.widget.end_datetime_status = true;
                this.widget.stop_timer();
                if (!message.play_a_sound && !message.stopline) {
                    this.audio_format = audio.canPlayType("audio/ogg; codecs=vorbis") ? ".ogg" : ".mp3";
                    audio.src = openerp.session.url("/project_timelog/static/src/audio/" + "stop" + this.audio_format);
                    audio.play();
                }
                if (message.play_a_sound && !self.widget.stopline) {
                    $('#clock0').css('color','rgb(152, 152, 152)');
                } else if (self.widget.stopline) {
                    $('#clock0').css('color','red');
                }
                if (message.stopline) {
                    $('#clock0').css('color','red');
                    if (self.stopline_audio_stop) {
                        this.audio_format = audio.canPlayType("audio/ogg; codecs=vorbis") ? ".ogg" : ".mp3";
                        audio.src = openerp.session.url("/project_timelog/static/src/audio/" + "stop" + this.audio_format);
                        audio.play();
                    }
                    self.stopline_audio_stop = false;
                }
            }
            if (message.status == "stopline") {
                var now = new Date();
                var year, month, day, minute;
                year = now.getFullYear();
                month = now.getMonth();
                day = now.getDay();
                minute = now.getMinutes();
                if (year == message.time.year && month == message.time.month && day == message.time.day) {
                    if (minute >=message.time.minute) {
                        $('#clock0').css('color','orange');
                        if (self.song_on) {
                            self.widget.playAudio(0);
                        }
                        self.stopline_audio_warning = false;
                    }
                }
            }
        },
    });

    TimeLog.TimelogWidget = openerp.Widget.extend({
        init: function(parent){
            this._super(parent);
            var self = this;
            this.load_server_data();

            this.finish_status = false;
            this.stopline = '';
            this.work_id = '';
            this.task_id = '';
            this.timelog_id='';
            this.status = 'stopped';
            this.times = [0,0,0,0];
            this.initial_planed_hours = 0;

            this.time_warning_subtasks = 1;
            this.time_subtasks = 1;

            this.normal_time_day = 1;
            this.good_time_day = 1;

            this.normal_time_week = 1;
            this.good_time_week = 1;

            this.timer_status = false;

            this.audio_format = '';
        },
        start: function() {
            var self = this;
            this.load_timer_data();
            window.offLineHandler = function(){
                self.ClientOffLine();
            };
            window.onLineHandler = function(){
                self.ClientOnLine();
            };
        },
        ClientOffLine: function() {
            console.log("YOU ARE OFFLINE");
            var self = this;
            self.end_datetime_status = true;
            self.audio_format= audio.canPlayType("audio/ogg; codecs=vorbis") ? ".ogg" : ".mp3";
            audio.src = openerp.session.url("/project_timelog/static/src/audio/"+"stop"+ self.audio_format);
            if (self.status == 'running') {
                audio.play();
            }
            self.stop_timer();
            self.warn_message = "No internet connection";
            self.warn_sticky = true;
            self.show_warn_message(this.warn_message, this.warn_sticky);
        },
        ClientOnLine: function(){
            console.log("YOU ARE ONLINE");
            this.warn_message = "You are online";
            this.warn_sticky = true;
            this.show_warn_message(this.warn_message, this.warn_sticky);
        },
        load_server_data: function() {
            var self = this;
            this.rpc("/timelog/upd", {}).then(function(resultat){
                self.uid = resultat.uid;
                self.dbname = resultat.dbname;
                self.c_manager = new openerp.TimeLog.Manager(self);
            });
        },
        load_timer_data: function(){
            var self = this;
            this.activate_click();
            this.rpc("/timelog/init", {}).then(function(resultat){
                self.timer_status = resultat.timer_status;
                self.stopline = resultat.stopline;
                self.task_id = resultat.task_id;
                self.work_id = resultat.work_id;
                self.timelog_id = resultat.timelog_id;
                self.initial_planed_hours = resultat.planned_hours;
                self.times = [
                    resultat.init_log_timer,
                    resultat.init_task_timer,
                    resultat.init_day_timer,
                    resultat.init_week_timer,
                    resultat.subtask_name
                ];
                self.time_warning_subtasks = resultat.time_warning_subtasks;
                self.time_subtasks = resultat.time_subtasks;

                self.normal_time_day = resultat.normal_time_day;
                self.good_time_day = resultat.good_time_day;

                self.normal_time_week = resultat.normal_time_week;
                self.good_time_week = resultat.good_time_week;

                self.end_datetime_status = resultat.end_datetime_status;

                if (self.time_subtasks<=self.times[0]) {
                    self.times[0] = self.time_subtasks;
                    self.finish_status = true;
                }
                self.add_title(resultat.subtask_name, resultat.task_name, resultat.description_second_timer);
                self.check_audio();
                self.updateView();
                if (self.timer_status) {
                    self.start_timer();
                }
            });
        },
        activate_click: function() {
            var self = this;
            $( "#clock0" ).click(function() {
                self.timer_pause();
            });

            $( "#clock1" ).click(function(event) {
                self.go_to(event, 'task');
            });

            $( "#clock2" ).click(function(event) {
                self.go_to(event, 'day');
            });

            $( "#clock3" ).click(function(event) {
                self.go_to(event, 'week');
            });
        },
        add_favicon: function() {
            if (this.status == 'stopped') {
                $('link[type="image/x-icon"]').attr('href', '/project_timelog/static/src/img/favicon_play.ico');
            }
            if (this.status == 'running') {
                $('link[type="image/x-icon"]').attr('href', '/project_timelog/static/src/img/favicon_stop.ico');
            }
        },
        check_audio: function() {
            if (typeof(Audio) === "undefined") {
                return;
            }
            this.audio_format= audio.canPlayType("audio/ogg; codecs=vorbis") ? ".ogg" : ".mp3";
            this.updateView();
        },
        updateView : function() {
            var element = document.getElementById("timelog_timer");
            if(!element) {
                return false;
            }
            for (var i = 0; i < 4; i++) {
              this.updateClock(i, this.times[i]);
            }
        },
        updateClock : function(id, time) {
            var element = document.getElementById("clock"+id);
            if(!element) {
                return false;
            }

            var formattedTime = this.formatTime(id, time);
            element.innerHTML = formattedTime;
            var self = this;

            switch(id) {
                case 0: {
                    if (self.status == 'stopped' && !self.stopline) {
                        $('#clock0').css('color','rgb(152, 152, 152);');
                    }
                    else {
                        $('#clock0').css('color','white');
                    }
                    if ( this.times[0] == this.time_warning_subtasks) {
                        $('#clock0').css('color','orange');
                        self.playAudio(0);
                    }
                    if ( this.times[0] > this.time_warning_subtasks) {
                        $('#clock0').css('color','orange');
                    }
                    if ( this.times[0] >= this.time_subtasks || self.stopline){
                        $('#clock0').css('color','red');
                        this.addClass(0, "expired");
                        if (id === 0) this.timerTimeLimited();
                    }
                } break;

                case 1:  {
                    if (this.initial_planed_hours === 0) {
                        break;
                    }
                    if (this.times[1] >= this.initial_planed_hours) {
                        $('#clock1').css('color','orange');
                    }
                    if (this.times[1] >= 2*this.initial_planed_hours) {
                        $('#clock1').css('color','red');
                        this.addClass(1, "expired");
                    }
                } break;

                case 2: {
                    if (this.times[2] >= this.normal_time_day){
                        $('#clock2').css('color','yellow');
                    }
                    if (this.times[2] >= this.good_time_day) {
                        $('#clock2').css('color','#00f900');
                    }
                } break;

                case 3: {
                    if (this.times[3] == this.normal_time_week){
                        $('#clock3').css('color','#00f900');
                        self.playAudio(2);
                    }
                    if (this.times[3] > this.normal_time_week){
                        $('#clock3').css('color','#00f900');
                    }
                    if (this.times[3] == this.good_time_week) {
                        $('#clock3').css('color','rgb(0, 144, 249)');
                        self.playAudio(3);
                    }
                    if (this.times[3] >= this.good_time_week) {
                        $('#clock3').css('color','rgb(0, 144, 249)');
                    }
                } break;

                default:
                    console.log("NONE");
                break;
            }
        },
        timerTimeLimited: function() {
            var self = this;
            if (self.finish_status) {
                return false;
            }
            var model = new openerp.web.Model('project.task.work');
            model.call("stop_timer", [self.work_id, true, false]);
            self.finish_status = true;
            var element = document.getElementById("clock0");
            this.startAnim(element, 500, 10*500);
            var id = this.task_id;
            var parent = self.getParent();
            var action = {
                res_id: id,
                res_model: "project.task",
                views: [[false, 'form']],
                type: 'ir.actions.act_window',
                target: 'current',
                flags: {
                    action_buttons: true,
                }
            };
            parent.action_manager.do_action(action);
            this.end_datetime_status = true;
            this.stop_timer();
        },
        addClass : function(id, className) {
            var clockClass = "#clock" + id;
            var element = $(clockClass+" "+className);
            if (element.length) {
                $(clockClass).removeClass(className);
            }
            $(clockClass).addClass(className);
        },
        removeClass : function(id, className) {
            var clockClass = "#clock" + id;
            $(clockClass).removeClass(className);
        },
        formatTime : function(id, time) {
            var minutes = Math.floor(time / 60);
            var seconds = Math.floor(time % 60);
            var hours = Math.floor(minutes / 60);
            minutes = Math.floor(minutes % 60);

            var result = "";
            if (hours < 10) result +="0";
            result += hours + ":";
            if (minutes < 10) result += "0";

            if (id === 0) {
                result += minutes + "<span id='clock_second'>" + ":";
                if (seconds < 10) result += "0"; result +=seconds + "</span>";
            }
            else result += minutes;
            return result;
        },
        setIntervalTimer: function() {
            var self = this;
            this.timer = window.setInterval(function(){
                self.countDownTimer();
            }, 1000);

        },
        countDownTimer: function() {
            var self = this;
            for (var i = 0; i < 4; i++) {
              self.times[i]++;
              self.updateClock(i, self.times[i]);
            }
        },
        start_timer: function(){
            if (this.status == 'running' || this.time_subtasks<=this.times[0]){
                return false;
            }
            if (this.stopline) return false;
            console.log("play");
            this.add_favicon();
            var self = this;
            this.status = 'running';
            this.setIntervalTimer();
            for (var i = 0; i < 4; i++) {
              this.addClass(i, "running");
            }
        },
        stop_timer: function(){
            var self = this;
            if (this.status == 'stopped'){
                if (self.end_datetime_status) {
                    return false;
                }
            }
            console.log("stop");
            this.add_favicon();
            this.status = 'stopped';
            for (var i = 0; i < 4; i++) {
                this.removeClass(i, "running");
            }
            clearTimeout(this.timer);
        },
        startAnim: function (element, interval, time) {
            var self = this;
            element.animTimer = setInterval(function () {
            if (element.style.display == "none")  {
                element.style.display = "";
                self.playAudio(1);
            }
            else
                element.style.display = "none";
            }, interval);
            setTimeout(function(){
                self.stopAnim(element);
            }, time);
        },
        stopAnim: function(element){
            clearInterval(element.animTimer);
            element.style.display = "";
        },
        playAudio: function(id) {
            var audio_name = id + '.' + this.audio_format;
            audio.src = openerp.session.url("/project_timelog/static/src/audio/"+id+ this.audio_format);
            audio.play();
        },
        add_title: function(first_timer_name, task_name, description_second_timer) {
            var tws = this.formatTime(1, this.time_warning_subtasks).split(':');
            var ts = this.formatTime(1, this.time_subtasks).split(':');
            var ntd = this.formatTime(1, this.normal_time_day).split(':');
            var gtd = this.formatTime(1, this.good_time_day).split(':');
            var ntw = this.formatTime(1, this.normal_time_week).split(':');
            var gtw = this.formatTime(1, this.good_time_week).split(':');

            $('#clock0').attr("title", 'Subtask: '+first_timer_name+'\n\nTotal time of the subtask.\n\n* White: time is less than '+ tws[0] +' hours '+tws[1]+' minutes;\n* Short Signal: time is '+ tws[0] +' hours '+tws[1]+' minutes;\n* Yellow: time between '+ tws[0] +' hours '+tws[1]+' minutes and '+ ts[0] +' hours '+ts[1]+' minutes;\n* Long Signal: timer is stopping.\n* Red: timer is stopped;\n\nClick to Play/Pause.');
            $('#clock1').attr("title", 'Task: '+task_name+'\n\nTotal time for the task (includes logs of other users): '+description_second_timer+"\n\n* White: time is less than 'initially planned hours';\n* Yellow: time is more than 'initially planned hours';\n* Red: time is twice more than 'initially planned hours';\n\nClick to open the task.");
            $('#clock2').attr("title", "Total time of the day.\n\n* White: time is less "+ ntd[0] +" hours "+ntd[1]+" minutes;\n* Yellow: time between "+ ntd[0] +" hours "+ntd[1]+" minutes and "+ gtd[0] +" hours "+gtd[1]+" minutes;\n* Green: time is more than "+ gtd[0] +" hours "+gtd[1]+" minutes;\n\nClick to open logs of the day.");
            $('#clock3').attr("title", "Total time of the week.\n\n* White: time is less than "+ ntw[0] +" hours "+ntw[1]+" minutes\n* Melody #1: time is "+ ntw[0] +" hours "+ntw[1]+" minutes;\n* Yellow: time between "+ ntw[0] +" hours "+ntw[1]+" minutes and "+ gtw[0] +" hours "+gtw[1]+" minutes;\n* Melody #2: time is "+ gtw[0] +" hours "+gtw[1]+" minutes;\n* Blue: time is more than "+ gtw[0] +" hours "+gtw[1]+" minutes;\n\nClick to open logs of the week.");
        },
        timer_pause: function() {
            var self = this;
            var model_subtask = new openerp.web.Model('project.task.work');
            if (self.status=="running" && !self.finish_status) {
                model_subtask.call("stop_timer", [self.work_id]);
                $('#clock0').css('color','rgb(152, 152, 152)');
            } else {
                if (self.status == "stopped" && !self.finish_status) {
                    model_subtask.call("play_timer", [self.work_id]);
                    $('#clock0').css('color','white');
                }
            }
            if (self.finish_status) return false;
        },
        go_to: function(event, status) {
            var self = this;
            var id = this.task_id;
            var parent = self.getParent();
            var action = {};
            var context;
            if (status == 'task') {
                action = {
                    res_id: id,
                    res_model: "project.task",
                    views: [[false, 'form']],
                    type: 'ir.actions.act_window',
                    target: 'current',
                    flags: {
                        action_buttons: true,
                    }
                };
            } else {
                if (status == 'day') {
                    context = {
                        'search_default_today': 1,
                        'search_default_group_tasks': 1,
                        'search_default_group_subtasks': 1,
                    };
                } else {
                    context = {
                        'search_default_week': 1,
                        'search_default_group_tasks': 1,
                        'search_default_group_subtasks': 1,
                    };
                }
                action = {
                    res_model: "project.timelog",
                    name: "My Timelog",
                    views: [[false, 'list'], [false, 'form']],
                    type: 'ir.actions.act_window',
                    domain: "[('user_id', '=', uid)]",
                    target: 'current',
                    view_mode: 'tree',
                    view_type: 'form',
                    context: context,
                    flags: {
                        action_buttons: true,
                    }
                };
            }
            parent.action_manager.do_action(action);
        },
        show_warn_message: function(warn_message, warn_sticky){
            var parent = this.getParent();
            parent.action_manager.do_warn(warn_message, warn_sticky);

        }
    });

    instance.web.WebClient.include({
        show_application: function() {
            var self = this;
            this.timelog_widget  = new TimeLog.TimelogWidget(self);
            this.timelog_widget.appendTo(this.$el.parents().find('.oe_timelog_placeholder'));
            return this._super();
        },
    });
});

