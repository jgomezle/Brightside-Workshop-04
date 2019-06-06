var gulp = require('gulp-help')(require('gulp'));
var gulpSequence = require('gulp-sequence');
var PluginError = require('plugin-error');
var cmd = require('node-cmd');

/**
 * await Job Callback
 * @callback awaitJobCallback
 * @param {Error} err 
 */

/**
* Polls jobId. Callback is made without error if Job completes with CC < MaxRC in the allotted time
* @param {string}           jobId     jobId to check the completion of
* @param {number}           [maxRC=0] maximum allowable return code
* @param {awaitJobCallback} callback  function to call after completion
* @param {number}           tries     max attempts to check the completion of the job
* @param {number}           wait      wait time in ms between each check
*/
function awaitJobCompletion(jobId, maxRC=0, callback, tries = 30, wait = 1000) {
  if (tries > 0) {
      sleep(wait);
      cmd.get(
      'bright jobs view job-status-by-jobid ' + jobId + ' --rff retcode --rft string',
      function (err, data, stderr) {
          retcode = data.trim();
          //retcode should either be null of in the form CC nnnn where nnnn is the return code
          if (retcode == "null") {
            awaitJobCompletion(jobId, maxRC, callback, tries - 1, wait);
          } else if (retcode.split(" ")[1] <= maxRC) {
            callback(null);
          } else {
            callback(new Error(jobId + " had a return code of " + retcode + " exceeding maximum allowable return code of " + maxRC));
          }
      }
      );
  } else {
      callback(new Error(jobId + " timed out."));
  }
}

/**
 * Sleep function.
 * @param {number} ms Number of ms to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

gulp.task('build-cobol', 'Build COBOL element', function (callback) {
  var endevor = (typeof process.env.ENDEVOR === "undefined") ? "" : process.env.ENDEVOR,
      command = "bright endevor generate element MARBLE04 --type COBOL --override-signout --maxrc 0 " + endevor;

  cmd.get(command, function (err, data, stderr) {
    if(err){
      callback(err);
    } else if (stderr){
      callback(new Error("\nCommand:\n" + command + "\n" + stderr + "Stack Trace:"));
    } else {
      callback();
    }
  });
});
gulp.task('build-lnk', 'Build Linked element', function (callback) {
  var endevor = (typeof process.env.ENDEVOR === "undefined") ? "" : process.env.ENDEVOR,
      command = "bright endevor generate element MARBLE04 --type LNK --override-signout --maxrc 0 " + endevor;

  cmd.get(command, function (err, data, stderr) {
    if(err){
      callback(err);
    } else if (stderr){
      callback(new Error("\nCommand:\n" + command + "\n" + stderr + "Stack Trace:"));
    } else {
      callback();
    }
  });
});
gulp.task('build', 'Build program', gulpSequence('build-cobol', 'build-lnk'));
gulp.task('copy-load', 'Copy Module', function (callback) {
  var FMP = (typeof process.env.FMP === "undefined") ? "" : process.env.FMP,
      command = "zowe fmp copy data-set PRODUCT.NDVR.MARBLES.MARBLES.D1.LOADLIB CICS.TRAIN.MARBLES.LOADLIB -m MARBLE04" + FMP ;

  cmd.get(command, function (err, data, stderr) {
    if(err){
      callback(err);
    } else if (stderr){
      callback(new Error("\nCommand:\n" + command + "\n" + stderr + "Stack Trace:"));
    } else {
      callback();
    }
  });
});
gulp.task('copy-dbrm', 'Copy DBRM', function (callback) {
  var FMP = (typeof process.env.FMP === "undefined") ? "" : process.env.FMP,

  command = "zowe fmp copy data-set PRODUCT.NDVR.MARBLES.MARBLES.D1.DBRMLIB BRIGHT.MARBLES.DBRMLIB -m MARBLE04" +FMP;

cmd.get(command, function (err, data, stderr) {
if(err){
  callback(err);
} else if (stderr){
  callback(new Error("\nCommand:\n" + command + "\n" + stderr + "Stack Trace:"));
} else {
  callback();
}
});
});
gulp.task('bind-n-grant', 'Bind y GRANT', function (callback) {
  
  command = 'bright jobs submit data-set "CUST004.MARBLES.JCL(MARBIND)" --rff jobid --rft string  ' ;

cmd.get(command, function (err, data, stderr) {
if(err){
  callback(err);
} else if (stderr){
  callback(new Error("\nCommand:\n" + command + "\n" + stderr + "Stack Trace:"));
} else {
  var jobid = data.trim();
  awaitJobCompletion(jobid,4,function(err){
    if (err) callback(err);
        else
    callback();
  })

}
});
});
gulp.task('cics-refresh', 'Refresh Porgram', function (callback) {
  var CICS= (typeof process.env.FMP === "undefined") ? "" : process.env.CICS,

  command = "bright cics refresh program MARBLE04" + CICS

cmd.get(command, function (err, data, stderr) {
if(err){
  callback(err);
} else if (stderr){
  callback(new Error("\nCommand:\n" + command + "\n" + stderr + "Stack Trace:"));
} else {
  callback();
}
});
});
gulp.task('deploy', 'Deploy program', gulpSequence('copy-load', 'copy-dbrm','bind-n-grant','cics-refresh'));