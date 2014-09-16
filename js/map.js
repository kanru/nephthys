/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; js-indent-level: 2; -*- */
(function(window) {
  var _start = Date.now();

  function random(start, end) {
    return Math.round(((start) + Math.random() * (end - start)));
  }

  /**
   * Enhance Raphael to have arrow render
   * @param  {Number} x1   Start point of x
   * @param  {Number} y1   Start point of y
   * @param  {Number} x2   End point of x
   * @param  {Number} y2   End point of y
   * @param  {Number} size Size of arrow
   * @return {Array}      Array containing line and arrow
   */
  Raphael.fn.arrow = function (x1, y1, x2, y2, size, color) {
    var angle = Math.atan2(x1-x2,y2-y1);
    angle = (angle / (2 * Math.PI)) * 360;
    //var arrowPath = this.path('M' + x2 + ' ' + y2 + ' L' + (x2 - size) + ' ' + (y2 - size) + ' L' + (x2 - size) + ' ' + (y2 + size) + ' L' + x2 + ' ' + y2 ).attr('stroke', color).attr('opacity', 0.5).transform('r' + (90+angle)).data('angle', 90 + angle);
    var arrowPath = this.circle(x2, y2, 1).attr('stroke', color).attr('opacity', 0.5).hide(); // cannot transform!!!
    var linePath = this.path('M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2).attr('stroke', color).attr('opacity', 0.5);
    return [linePath, arrowPath];
  }

  Raphael.el.is_visible = function() {
    return (this.node.style.display !== 'none');
  }

  var Isis = {
    TIME_FACTOR: 0.5,
    WIDTH: 700,
    HEIGHT: 800,
    LEFT: 150,
    TOP: 40,
    start: 0,
    end: 0,
    interval: 0,
    count: 0,
    init: function Isis_init() {
      this.chooseButton = document.getElementById('choose');
      this.mapContainer = document.getElementById('mapContainer');
      this.slideContainer = $('#slideContainer');
      var self = this;
      if (location.hash) {
        $.get(location.hash.substring(1),
              function(data) {
                window.broadcaster.emit('profile-imported-stage-0');
                window.broadcaster.emit('profile-imported');
                self.parse(data);
              }, 'json');
      } else {
        $(function() {
          $('input[type=file]').bootstrapFileInput();
          $('#choose').change(function(evt) {
            self.read(evt);
          });
        });
      }
      window.addEventListener('ui-resize', this.resize.bind(this));
    },

    publish: function(event, detail) {
      window.dispatchEvent(new CustomEvent(event, { detail: detail }));
    },

    read: function(evt) {
      var files = evt.target.files;
      var self = this;
      for (var i = 0, f; f = files[i]; i++) {
        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = (function(theFile) {
          return function(e) {
            window.broadcaster.emit('profile-imported-stage-0');
            window.broadcaster.emit('profile-imported');
            self.parse(e.target.result);
          };
        })(f);

        // Read in the image file as a data URL.
        reader.readAsText(f);
      }
    },

    handleEvent: function Isis_handleEvIsist(evt) {
      console.log('handling ' + evt.type + ' on ' + evt.target);
      switch (evt.target) {
        case this.source:
          this.parse(evt.target.value);
          break;
      }
    },

    resize: function Isis_resize(event) {
    },

    clear: function Isis_clear(resetColor) {
      this.renderTooltip();
      this.count = 0;
      this.taskSets = {};
      if (resetColor) {
        this._colors = {};
      }
      this._threadRendered = {};
    },

    renderTooltip: function() {
    },

    parse: function Isis_parse(string) {
      this.clear(true);
      var object;
      if (typeof string === 'string') {
        object = JSON.parse(string);
      } else if (typeof string === 'object') {
        object = string;
      }
      this.start = object.start || object.begin;
      // XXX: fix me
      this.end = object.end;
      this.interval = this.end - this.start;
      window.broadcaster.emit('range-created', this.start, this.interval);
      var self = this;
      if (Array.isArray(object.tasks)) {
        this.currentTasks = object.tasks;
        this._currentThreads = object.threads;
        window.app.processManager.update(object);
      }

      this.buildThreads();
      this.buildSourceEvents();
      window.broadcaster.emit('tasks-initing', this.currentTasks, this._ignoredTasks);

      this.render();
    },

    _intervalH: 15,
    _offsetX: 200,
    _offsetY: 20,
    _taskHeight: 10,
    _taskMinWidth: 1,

    buildThreads: function() {
      this.currentThreads = {};
      this.currentProcessThreads = {};
      this._ignoredTasks = [];
      if (!this.currentTasks) {
        return;
      }
      this.currentTasks.forEach(function iterator(task) {
        if (!task.threadId) {
          this._ignoredTasks.push(task);
          return;
        }
        if (!this.currentThreads[task.threadId]) {
          this.currentThreads[task.threadId] = [];
          // Group threads into processes
          if (!this.currentProcessThreads[task.processId]) {
            this.currentProcessThreads[task.processId] = [];
          }
          this.currentProcessThreads[task.processId].push(task.threadId);
        }
        if (task.sourceEventId === null) {
          return;
        }
        this.currentThreads[task.threadId].push(task);
      }, this);
    },

    buildSourceEvents: function() {
      this.currentSourceEventTypes = {};
      this.currentSourceEventIds = {};
      if (!this.currentTasks)
        return;
      this.currentTasks.forEach(function iterator(task) {
        if (!this.currentSourceEventTypes[task.sourceEventType]) {
          this.currentSourceEventTypes[task.sourceEventType] = [];
        }
        this.currentSourceEventTypes[task.sourceEventType].push(task);
        if (!this.currentSourceEventIds[task.sourceEventId]) {
          this.currentSourceEventIds[task.sourceEventId] = [];
        }
        this.currentSourceEventIds[task.sourceEventId].push(task);
      }, this);
    },

    render: function Isis_render() {
      this._colors = {};
      this._threadRendered = {};
      var self = this;

      // Collect all process ids
      var procs = [];
      for (var proc in this.currentProcessThreads) {
        procs.push(proc);
      }
      procs.sort();

      // concat threads of processes into a list
      var ids = [];
      for (var idx in procs) {
        var proc = procs[idx];
        this.currentProcessThreads[proc].sort();
        ids = ids.concat(this.currentProcessThreads[proc]);
      }

      var accumulatedOffsetY = 0;
      for (var idx in ids) {
        var id = ids[idx];
        var thread = new Thread({
          id: id,
          tasks: this.currentThreads[id],
          processId: this.currentThreads[id][0].processId,
          name: this.getThreadName(id),
          start: this.start,
          end: this.end,
          interval: this.end - this.start,
          canvas: window.app.threadManager.getCanvas(),
          offsetY: accumulatedOffsetY
        });
        accumulatedOffsetY += thread.HEIGHT;
      }

      for (var id in this.currentSourceEventTypes) {
        var sourceEventType = new SourceEventType({
          type: id,
          tasks: this.currentSourceEventTypes[id]
        });
      }

      for (var id in this.currentSourceEventIds) {
        var sourceEventId = new SourceEventID({
          start: this.start,
          end: this.end,
          interval: this.end - this.start,
          id: id,
          tasks: this.currentSourceEventIds[id]
        });
      }
    },
    getThreadName: function(id) {
      var name = '';
      if (this._currentThreads) {
        this._currentThreads.some(function(thread) {
          if (Number(thread.threadId || thread.id) === Number(id)) {
            name = thread.threadName || thread.name;
            return true;
          }
        }, this)
      }
      return name;
    }
  };
  window.Isis = Isis;
}(this));
